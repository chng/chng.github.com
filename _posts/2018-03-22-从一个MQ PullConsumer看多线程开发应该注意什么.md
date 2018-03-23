---
layout: post
title: 从Mq说多线程开发应该注意什么
date: 2018-03-22
categories: Java
tag:
  - Java@
  - 后端

---

## 基础知识

叨叨一些简单的基础知识，高手略过。

#### 分布式消息队列

指的是一种用于消息排队和消费的中间件，生产者向一个队列(Topic)里发送消息，消费者按组订阅该队列((Topic)，并消费消息。观察者模式的分布式版本。常见用途有二：

1. 解耦，多个系统之间通过消费者生产者模式解耦
2. 削峰填谷，处理不完的请求在队列里排队

使用前提是，容许消息的短时间延时。

阿里开源的RoketMq是一种分布式消息队列的实现，内部版本名为MetaQ。

#### 物理队列和逻辑队列

对于一个Topic，真正持久化(或者理解为缓存)这个Topic的所有消息的队列被称为物理队列，Topic和物理队列是一对一的，那么如何支持当多个系统同时订阅一个Topic呢？这里就有ConsumerGroup逻辑队列的概念，多个系统订阅同一个Topic，但分别在不同的分组中。MetaQ的做法是给每个ConsumerGroup分配一个逻辑队列，每个逻辑队列里又有多个分片，每个分片里面保存当前分片的消费进度(offset)。


#### 推模式/拉模式

消息的消费有两种方式：

1. 推模式，由分布式消息队列将最新生产出来的消息，主动推送给消费者
2. 拉模式，消费者主动轮训队列，把最新生产的消息拉取过来消费

MetaQ提供了两种消费方式：Push Consumer和PullConsumer。据官方文档，底层都使用了基于长轮训(Long Polling)的拉模式来消费消息。

1. Push Consumer: 用户将监听器(Listener)注册到Consumer里，Consumer有新消息是回调Listener（同步/异步）。
2. Pull Consumer: 用户自己来轮训每个逻辑队列，

简单的做法是使用Push Consumer，因为应用程序只需要关心Listener内部的业务就好了。Pull Consumer提供了比较灵活的能力，把轮训交给了应用程序来做，以便满足一些特殊的需求 (虽然目前我还没想到有什么特殊的需求)。

#### 同步非阻塞IO模型，epoll模型，react模式，Netty

MetaQ底层采用的是常见的同步非阻塞IO模型，具体请参考《Unix网络编程》中对四种IO模型的清晰介绍。简单来说，同步非阻塞模型是是基于事件的，在做IO读写时，注册一个读写事件，然后立即返回，当读写完成时通知这个事件已经完成。Linux内核中有三种实现：
1. select: 采用一个位图结构，每一位代表一个socket，用这一位表示这个socket是否有读完成/写完成的事件。这种做法需要轮训这个位图。缺点是由于位图长度有限，socket个数也有限
2. poll: select改进版，不再是位图，而是array。
3. epoll: poll的升级版，其实和poll的套路大有不同，采用了红黑树的接口来同时解决socket个数有限和快速查找的问题，参考《深入探索Nginx》。

在Java里，用相同的原理实现了同步非阻塞IO模型，成为NIO。这样的做法在设计模式里，可以抽象为反应堆模式(React Pattern)。而Netty就是Java中基于Java NIO和Direct Memory Buffer实现的网络库。

MetaQ底层依赖了Netty。


### 以下正文

下面我们单纯以学习的目的，来用Pull Consumer写一个MetaQ的消费者模板类，这个过程并不简单，其中涉及到许多在多线程场景下要注意的事情。先上代码，再解释。

~~~java

import java.io.IOException;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.ThreadPoolExecutor.DiscardPolicy;
import java.util.concurrent.TimeUnit;

import com.alibaba.rocketmq.client.consumer.PullCallback;
import com.alibaba.rocketmq.client.consumer.PullResult;
import com.alibaba.rocketmq.client.exception.MQClientException;
import com.alibaba.rocketmq.common.message.MessageExt;
import com.alibaba.rocketmq.common.message.MessageQueue;

import com.google.common.collect.Sets;
import com.taobao.metaq.client.MetaPullConsumer;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;

/**
 * @author shutong
 *
 * 如果用Pull Consumer消费metaq消息，可以怎么写？
 *
 */
@Slf4j
public abstract class AbstractMetaqPullListener {
    private MetaPullConsumer consumer;
    private Set<MessageQueue> mqs;
    private int metaqMessageMaxSize = 64;
    /**
     * 每个queue的offset
     */
    private Map<MessageQueue, Long> offseTable = new HashMap<MessageQueue, Long>();
    /**
     * 每个queue的执行线程
     */
    private Map<MessageQueue, PullAndHandleTask> workers = new HashMap<MessageQueue, PullAndHandleTask>();
    /**
     * 定时检查queue是否有变化的线程
     */
    private ScheduledThreadPoolExecutor scheduled = new ScheduledThreadPoolExecutor(1);
    /**
     * 每个q的执行线程的池子
     */
    private ThreadPoolExecutor pool = new ThreadPoolExecutor(4, 16, 60, TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(100), new DiscardPolicy());


    protected abstract void doInit() throws Exception;

    protected abstract void doDestory();

    protected abstract void doComsumeMessage(byte[] event) throws IOException;

    protected abstract String mqTopic();

    protected abstract String mqConsumerGroup();


    /**
     * 子类必须调用
     */
    protected void init() throws Exception {
        log.warn("metaq listener is starting, topic: {} ....", mqTopic());
        consumer = new MetaPullConsumer(mqConsumerGroup());
        try {
            consumer.start();

            //请求这个topic下的队列
            mqs = consumer.fetchSubscribeMessageQueues(mqTopic());
        } catch (MQClientException e) {
            log.error("metaq listener starting failed, topic: {} {} ....", mqTopic(), e.getMessage());
            throw new RuntimeException(e);
        }
        //如果没有队列，则不能启动
        if(CollectionUtils.isEmpty(mqs)) {
            log.error("metaq queue is not found, topic: {} ....", mqTopic());
            throw new RuntimeException("未找到可消费的metaq队列, topic:"+mqConsumerGroup());
        }
        //给每个队列分配执行线程
        for (MessageQueue mq : mqs) {
            PullAndHandleTask task = new PullAndHandleTask(mq);
            workers.put(mq, task);
            pool.submit(task);
        }

        //定时检查队列，如果队列有变化了，必须重新分配线程需处理
        scheduled.scheduleAtFixedRate(new Runnable() {
            @Override
            public void run() {
                //请求这个topic下的队列
                try {
                    mqs = consumer.fetchSubscribeMessageQueues(mqTopic());
                } catch (MQClientException e) {
                    log.error("metaq queue is not found, topic: {} {} ....", mqTopic(), e.getMessage());
                }
                if(mqs != null) {
                    Set<MessageQueue> newMqs = Sets.newHashSet();
                    for (MessageQueue mq : mqs) {
                        newMqs.add(mq);
                    }
                    //被删除的，要从原来的集合里删掉，同时停掉他们的处理线程
                    Collection<MessageQueue> deleted = CollectionUtils.subtract(workers.keySet(), newMqs);
                    for (MessageQueue mq : deleted) {
                        PullAndHandleTask task = workers.get(mq);
                        task.stop();
                        workers.remove(mq);
                    }
                    //新增的，加到执行线程的集合里
                    Collection<MessageQueue> added = CollectionUtils.subtract(newMqs, workers.keySet());
                    for (MessageQueue mq : added) {
                        PullAndHandleTask task = new PullAndHandleTask(mq);
                        workers.put(mq, task);
                        pool.submit(task);
                    }
                }
            }
        }, 30L, 30L, TimeUnit.SECONDS);
    }


    private void pullAndSyncHandle(MessageQueue mq) {
        try {
            //对于一个mq队列，从上一次的offset处拉N个消息
            //如果没有可消费的消息，就block直到有消息可消费
            //同步处理数据
            PullResult pullResult = consumer.pullBlockIfNotFound(mq, null,
                getMessageQueueOffset(mq),
                metaqMessageMaxSize);
            if (pullResult.getPullStatus() == com.alibaba.rocketmq.client.consumer.PullStatus.FOUND) {
                handle(pullResult);
            }
            //处理完了才设置新的offset，新的offset从是
            putMessageQueueOffset(mq, pullResult.getNextBeginOffset());
        } catch (Exception e) {
            //出错继续走，只是不更新offset了
            log.error(e.getMessage(), e);
        }
    }


    private void pullAndASyncHandle(MessageQueue mq) {
        try {
            //对于一个mq队列，从上一次的offset处拉N个消息
            //如果没有可消费的消息，就block直到有消息可消费
            //异步处理，当前线程等异步callback从netty返回或者异常时才被唤醒，如果成功则继续读下一个offset，否则重新读一次。
            Thread thread = Thread.currentThread();
            consumer.pullBlockIfNotFound(mq, null,
                getMessageQueueOffset(mq),
                SwitchConfig.metaqMessageMaxSize,
                new PullCallback() {
                    @Override
                    public void onSuccess(PullResult pullResult) {
                        if (pullResult.getPullStatus() == com.alibaba.rocketmq.client.consumer.PullStatus.FOUND) {
                            handle(pullResult);
                        }
                        //处理完了才设置新的offset，新的offset从是
                        putMessageQueueOffset(mq, pullResult.getNextBeginOffset());
                        synchronized (thread) {
                            thread.notify();
                        }
                    }

                    @Override
                    public void onException(Throwable e) {
                        log.error(e.getMessage());
                        synchronized (thread) {
                            thread.notify();
                        }
                    }
                });
            synchronized (thread) {
                thread.wait(2000);
            }
        } catch (Exception e) {
            //出错继续走，只是不更新offset了
            log.error(e.getMessage(), e);
        }
    }

    private void handle(PullResult pullResult) {
        List<MessageExt> msgs = pullResult.getMsgFoundList();
        if(CollectionUtils.isNotEmpty(msgs)) {
            for (MessageExt msg : msgs) {
                if (msg == null || msg.getBody() == null || msg.getBody().length<=0) {
                    continue;
                }
                try {
                    doComsumeMessage(msg.getBody());
                } catch (Throwable e) {
                    log.error(e.getMessage(), e);
                }
            }
        }
    }

    private long getMessageQueueOffset(MessageQueue mq) {
        Long offset = offseTable.get(mq);
        if (offset != null) {
            return offset;
        }

        return 0;
    }

    private void putMessageQueueOffset(MessageQueue mq, long offset) {
        offseTable.put(mq, offset);
    }


    /**
     * 子类必须调用
     */
    public void destroy() {
        log.info("Metaq listener is shuting down...");
        consumer.shutdown();
        log.info("Metaq listener shut down.");
    }



    class PullAndHandleTask implements Runnable {
        private volatile boolean active = true;
        public void stop() {
            active = false;
        }
        private MessageQueue mq;

        public PullAndHandleTask(MessageQueue mq) {
            this.mq = mq;
        }

        @Override
        public void run() {
            while (true) {
                if(!active) {
                    break;
                }
                try {
                    pullAndASyncHandle(mq);
                } catch (Exception e) {
                    log.error(e.getMessage(), e);
                }
            }
        }
    }
}

~~~

#### 大致的模型
1. 程序启动之后先初始化MetaQ Consumer，订阅一个Topic，然后得到我们ConsumerGroup下的所有分片(MessageQueue)。
2. 对每个分片，起一个读取并消费这个分片里的消息的任务(worker)。

#### 代码里的几个点
1. 我要周期性地取获取这个topic下的所有queue，因为严格意义上说，queue是可能存在扩容和迁移的情况的，也就是说他们会变更。
1. 先以同步的当时获取全部queue，并检查是否为空，然后才启动各个分片的worker, 而不是直接把一个立即执行的周期调度线程扔到ScheduledThreadPoolExecutor，以免在查询queue失败或者为空的时候，仍然启动程序，造成短期内的不正常服务。可以看看这个池子的代码，简单来说如果这个池子的任务抛异常，则任务被杀死，终止调度，如果不抛异常，一个周期后继续下一个调度。
2. 如果queue有变更，对于新增的queue我自然要分配新的worker，对于已经被删除的queue，我要从把它们的worker停掉，不能让已经坏掉的worker一直占用资源。为了停掉它，我使用了volatile变量，这种变量在写者唯一的情况下，可以保证新值对多个读者可见。
3. 每一个worker都要循环地取读取和消费消息，这里面有两种方式：同步、异步。同步方式：读完一批数据，然后处理，然后读下一批；异步方式：发起一个读请求，然后释放CPU，等读请求完成了，自动回调callback方法来处理，在callback中更新这个分区的offset，然后唤起线程继续读。
4. 显然异步的消费方式在性能上更有优势，即便Listener是一个体量比较大的耗时操作，对消费线程本身和整个系统的影响也不会太大。但是异步方式略微麻烦了一点，因为下一次读必然要依赖下一个offset。这里我用对象的wait/notify来写。
4. 如果深入MetaQ的代码，我们可以发现，异步消费的方式其实依赖了Netty，我们的异步回调方法，实际上委托给了Netty：当一次读消息的操作完成时，由Netty来执行回调方法。
5. 如果消息处理失败，是否允许重试？上面的代码中并没有重试，而是fail fast了。不同场景需要不同的做法：直接失败，继续消费下一个；或者卡在这里不断重试；或者重试N次后失败。实际上作为一个模板类，如果能提供多种option也是极好的。
6. 可以看到我们用到的两个线程池，都是手动new出来的，而没有用工厂方法。对于手动new出来的线程池，我们可以自己控制以下几个重要的参数，这些参数在任何情况下使用线程池时都需要格外注意：
  2. maxPoolSize: 最大线程数，如果当前已经到达最大线程，新来的线程要放到任务队列里等着。参考JDK代码注释。
  1. coreSize: 可以理解为核数，如果coreSize=2，maxPoolSize=5，第一个线程进来时，池子大小为1，第二个进来时，池子大小为2，第3个进来时，赤字大小为3，两个线程退出了，池子的大小会维持在2. 参考JDK代码注释。
  3. keepAliveTime: 不活跃的线程最多活多久。如果太大，则池子空线程会太多，太小则会导致频繁创建和销毁线程。
  4. 任务队列：许多工厂方法默认是无界队列，很容易引起雪崩。
  5. 拒绝策略：处理不动的时候采用什么策略，是直接拒绝，还是丢给主线程来执行，还是别的。参考JDK源码。

7. 另外想提一下，我们的ScheduledThreadPoolExecutor半分钟执行一次，并且基本上能够保证半分钟内一定能完成里面的操作。但是如果加快成1s、100ms、10ms呢？如果里面的操作是个无法保证成本的钩子方法呢？所有能创建ScheduledThreadPoolExecutor的方法都有以下共有的特点：
  8. maxPoolSize都是Integer.MAX_VALUE, 线程可以一直创建下去
  9. 任务队列是该线程池的私有内部类DelayedTaskQueue，是个无界队列
  
 因此在使用这个类时一定要格外注意：
 
  1. 像上面的程序一样，保证调度时间足够长，能完成周期任务，这大概也是ScheduledThreadPoolExecutor设计的基本前提
  3. 网上有人提出用反射来修改maxPoolSize和任务队列的方法，不存在的，因为DelayedTaskQueue是一个有特殊用处(实际上是个优先队列)的“私有内部类”。
  4. 正经做法是，把重的操作仍到另一个线程池里，保证ScheduledThreadPoolExecutor里的任务不阻塞就好了。


以上。