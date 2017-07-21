---
layout: post
title: 基于令牌桶的流控小工具RateLimiter源码窥视
date: 2017-07-20
categories: Java
tag:
  - Java
  - 后端

---

Google Guava的RateLimiter是一个简易的流控工具，近日阅读《京麦京东开发平台的高性能架构之路》一文，提到京东用RateLimiter+zk来做流控，于是资料查了一把，源码看了一波。RateLimiter使用的是一种叫令牌桶的流控算法，RateLimiter会按照一定的频率往桶里扔令牌，线程拿到令牌才能执行，比如你希望自己的应用程序QPS不要超过1000，那么RateLimiter设置1000的速率后，就会每秒往桶里扔1000个令牌。

~~~java
RateLimiter rateLimiter = RateLimiter.create(1000);
...
rateLimiter.acquire(1); // sleep, 阻塞等待新的令牌
if(rateLimiter.tryAcquire(1)) {
    ...
} else {
    log.warn("flow limitted");
}
~~~

RateLimiter有两个实现类，SmoothBursty和SmoothWarmUp，从命名上可以看出SmoothWarmUp还提供了服务预热的能力，这点适用于需要预热缓存或者使用了分层编译的应用。RateLimiter提供两个工厂方法来创建这两个实现类的示例。UML图如下：

![]({{site.baseurl}}/assets/images/CMS/ratelimiter-uml-class.png)


### RateLimiter类

RateLimiter有几个主要的public方法：

~~~java
public static RateLimiter create(double permitsPerSecond)
~~~
指定一个qps阈值，创建一个SmoothBursty实例。当qps超过阈值时，SmoothBursty会通过控制令牌的释放频次，保证qps不超过阈值。如果一段时间内没有流量，SmoothBursty还会存储令牌。


~~~java
public static RateLimiter create(double permitsPerSecond, long warmupPeriod, TimeUnit unit)
~~~
指定一个qps阈值和一段warmup时间，返回一个SmoothWarmUp实例。在warmup时间内，服务的qps以一定的斜率逐步上升直到阈值。源码中给出一段清晰的解释。而如果SmoothWarmUp在热身时间内没有足够饱和的请求, 则会逐渐降低到冷却状态

~~~java
  /**
   * This implements the following function:
   *
   *          ^ throttling
   *          |
   * 3*stable +                  /
   * interval |                 /.
   *  (cold)  |                / .
   *          |               /  .   <-- "warmup period" is the area of the trapezoid between
   * 2*stable +              /   .       halfPermits and maxPermits
   * interval |             /    .
   *          |            /     .
   *          |           /      .
   *   stable +----------/  WARM . }
   * interval |          .   UP  . } <-- this rectangle (from 0 to maxPermits, and
   *          |          . PERIOD. }     height == stableInterval) defines the cooldown period,
   *          |          .       . }     and we want cooldownPeriod == warmupPeriod
   *          |---------------------------------> storedPermits
   *              (halfPermits) (maxPermits)
   */
~~~

setRate()和getRate()代理给了RateLimiter的子抽象类SmoothRateLimiter的doSetRate()和doGetRate()：

~~~Java
  @Override
  final double doGetRate() {
    return SECONDS.toMicros(1L) / stableIntervalMicros;
  }
~~~

~~~Java
  @Override
  final void doSetRate(double permitsPerSecond, long nowMicros) {
    resync(nowMicros);
    double stableIntervalMicros = SECONDS.toMicros(1L) / permitsPerSecond;
    this.stableIntervalMicros = stableIntervalMicros;
    doSetRate(permitsPerSecond, stableIntervalMicros);
  }
~~~
其中，doSetRate是个模板方法，先调用resync方法更新了下次释放令牌的时间nextFreeTicketMicros和目前保有的令牌数storedPermits。然后调用实现类自己的doSetRate(). 

~~~java
public double acquire() {
    return acquire(1);
}

public double acquire(int permits) {
  long microsToWait = reserve(permits);
  stopwatch.sleepMicrosUninterruptibly(microsToWait);
  return 1.0 * microsToWait / SECONDS.toMicros(1L);
}
~~~
acquire方法先“预定”n个令牌。如果有足够令牌，reserve立即修改storedPermits，否则，reservce告诉acquire方法还有microsToWait的时间要等待。于是acquire调用stopwatch睡上microsToWait长的时间，然后返回。真的是Thread.sleep(). 

~~~java
  final long reserve(int permits) {
    checkPermits(permits);
    synchronized (mutex()) {
      return reserveAndGetWaitLength(permits, stopwatch.readMicros());
    }
  }
  
  final long reserveAndGetWaitLength(int permits, long nowMicros) {
    long momentAvailable = reserveEarliestAvailable(permits, nowMicros);
    return max(momentAvailable - nowMicros, 0);
  }
  
  @Override
  final long reserveEarliestAvailable(int requiredPermits, long nowMicros) {
    resync(nowMicros);
    long returnValue = nextFreeTicketMicros;
    double storedPermitsToSpend = min(requiredPermits, this.storedPermits);
    double freshPermits = requiredPermits - storedPermitsToSpend;

    long waitMicros = storedPermitsToWaitTime(this.storedPermits, storedPermitsToSpend)
        + (long) (freshPermits * stableIntervalMicros);

    this.nextFreeTicketMicros = nextFreeTicketMicros + waitMicros;
    this.storedPermits -= storedPermitsToSpend;
    return returnValue;
  }
~~~
可以看到，如果调用者要求拿到permits个令牌，如果目前保有的令牌数足够，则waitMicros=0，无需等待；否则，计算还要等多久才能等到剩下的requiredPermits - storedPermits个令牌。之羽还要等多久，和SmoothBusty和SmoothWarmingUp自己的策略有关(二者分别实现了storedPermitsToWaitTime方法)。

~~~java
class SmoothBursty {
    ....
    
    @Override
    long storedPermitsToWaitTime(double storedPermits, double permitsToTake) {
      return 0L;
    }
}

class SmoothWarmingUp {
    ....
    
    @Override
    long storedPermitsToWaitTime(double storedPermits, double permitsToTake) {
      double availablePermitsAboveHalf = storedPermits - halfPermits;
      long micros = 0;
      // measuring the integral on the right part of the function (the climbing line)
      if (availablePermitsAboveHalf > 0.0) {
        double permitsAboveHalfToTake = min(availablePermitsAboveHalf, permitsToTake);
        micros = (long) (permitsAboveHalfToTake * (permitsToTime(availablePermitsAboveHalf)
            + permitsToTime(availablePermitsAboveHalf - permitsAboveHalfToTake)) / 2.0);
        permitsToTake -= permitsAboveHalfToTake;
      }
      // measuring the integral on the left part of the function (the horizontal line)
      micros += (stableIntervalMicros * permitsToTake);
      return micros;
    }
}    
~~~

对于SmoothBursty，直接等待(freshPermits * 1/qps)时间，因为SmoothBursty每1/qps必然释放一个令牌；对于SmoothWarmingUp，则要等更久。




