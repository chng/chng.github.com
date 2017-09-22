---
layout: post
title: 从Spring @Transaction说事务管理
date: 2017-09-15
categories: Java
tag:
  - Java@
  - 后端

---

@Transactional注解是spring提供的事务管理注解。但我在使用该注解的时候，发现事务方法抛出异常时并不会回滚，几番搜索之后得到了答案。

## Basics of transaction and @Transactional

这要从事务以及Transactional的定义说起。点开源码可以看到这个注解的定义如下：

~~~java
// 可以注解在方法或类上，不过spring建议注解在类上，原因与其实现机制有关
@Target({ElementType.METHOD, ElementType.TYPE})  
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@Documented
public @interface Transactional {

    // 事务管理器的bean名称
    @AliasFor("transactionManager")
    String value() default "";
    @AliasFor("value")
    String transactionManager() default "";

    // 事务的传播性，即被调用者的事务与调用者的事务之间的关系
    //默认是REQUIRED，表示如果当前存在事务，则加入到该事务中，否则创建一个新事务
    Propagation propagation() default Propagation.REQUIRED;

    // 事务的隔离级别，有RR RU RC Serialize四种
    Isolation isolation() default Isolation.DEFAULT;

    int timeout() default TransactionDefinition.TIMEOUT_DEFAULT;

    boolean readOnly() default false;

    // 发生什么异常时进行事务回滚
    Class<? extends Throwable>[] rollbackFor() default {};
    String[] rollbackForClassName() default {};

    // 发生什么异常时不进行事务回滚
    Class<? extends Throwable>[] noRollbackFor() default {};
    String[] noRollbackForClassName() default {};
}
~~~

### 1. 事务的传播性

表示一个调用方的事务和被调用方的事务之间的传播关系。

Spring对此的官方解释是：
![]({{site.baseurl}}/assets/images/CMS/spring-transaction.png)

- MANDATORY：要求当前在一个事务中，否则抛异常。
- NESTED：嵌套级别事务，如果上下文中存在事务，则嵌套事务执行，如果不存在事务，则新建事务(和REQUIRED级别一样)。 父事务执行子事务前创建check point，如果子事务回滚了，父事务回到check point继续执行。
- NEVER：如果上下文中有事务，就跑异常。
- NOT_SUPPORTED：如果上下文中有事务，就挂起线程。
- REQUIRED：如果当前存在事务，则加入到该事务中，否则创建一个新事务。
- REQUIRES_NEW：如果当前存在事务，则挂起，否则创建一个新事务。
- SUPPORTS：如果当前存在事务，则加入到该事务中，否则不以事务的方式执行。

### 2. 事务的隔离级别

事务的隔离级别根据对数据一致性的不同级别的要求，分为四种
- Read Uncommitted (RU)
- Read Committed (RC)
- Read Repeated (RR)
- Serialize
美团的一篇博客通过实例做了清晰的解释。[点这里](https://tech.meituan.com/innodb-lock.html)。

## 从问题排查顺序说Trancactional的原理

### 1. 有没有申明rollbackFor

rollbackFor表示在抛出何种异常时执行事务的回滚。默认是RuntimeException。如果要捕获所有的异常，应该这么写：
~~~java
@Transactional(rollbackFor = {Exception.class, RuntimeException.class})
~~~
*注意，Mybatis的很多异常，都是RuntimeExceotion。*

### 2. propagation是否符合场景
通常，默认的REQUIRED适用于大多数场景，但也要具体问题具体分析。

### 3. 有没有声明事务管理器

@Transactional需要配合事务管理器，才能起作用。不然，谁去创建check point、谁去回滚事务呢？

~~~java
@Transactional(value="txManager" rollbackFor = {Exception.class, RuntimeException.class})
~~~

~~~xml
<bean id="txManager" class="org.springframework.jdbc.datasource.DataSourceTransactionManager">
	<property name="dataSource" ref="remoteConfigDataSource" />
</bean>
<!-- annotation方式事务支持-->
<tx:annotation-driven transaction-manager="txManager" proxy-target-class="true" />
~~~

### 4. 让spring扫描到你的注解

~~~xml
	<context:component-scan base-package="com.taobao.xxx.xxx"/>
~~~

### 5. @Transaction注解建议打在实现类／实现方法上

你可能会注意到<tx:annotation-driven>标签上的proxy-target-class选项。spring的官方解释是：

>  Applies to proxy mode only. Controls what type of transactional proxies are created for classes annotated with the @Transactional annotation. If the proxy-target-class attribute is set to true, then class-based proxies are created. If proxy-target-class is false or if the attribute is omitted, then standard JDK interface-based proxies are created. (See Section 11.6, “Proxying mechanisms” for a detailed examination of the different proxy types.)

这里要说到spring的实现方式。spring通过AOP的方式把打上了@Transactional的类创建代理类，通过这种方式在@Transactional方法执行的前后做创建check point和回滚的工作。

- proxy-target-class不声明或proxy-target-class=false时，则创建JDK原生的基于接口的动态代理，@Transactional要打在接口上。
- 否则，创建代理类，@Transactional可以打在实现类或实现方法上。

Spring官方的建议将@Transaction打在实现类／实现方法上，因为注解是不能被继承的。

### 6. 避免在内部类调用事务方法，除非此时不需要事务

你对一个方法注解上了@Transactional，然后在内部类调用该方法，此时，该方法的执行无论如何都不会作为事务被管理起来的。因为前面讲到，spring是通过代理类的方式实现事务的管理，在内部类调用时，是通过this指针直接找到该方法的，并没有走代理类。


最后，good luck.
