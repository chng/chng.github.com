​---
layout: post
title: Ajax请求携带Cookie
date: 2017-03-08
categories: 前端
tag:
  - 前端
---


有三种情况，ajax请求是默认带cookie的，因此不必考虑携带cookie的问题：
1. 在不跨域请求的情况下；
2. 跨域时使用jsonp方式进行请求
3. 多记一笔，A页面iframe B页面时，B页面也可以获取A的cookie

当使用普通json的方式发送ajax请求时，如果要带上cookie则需要如是写：

~~~javascript
$.ajax({
	url: xxx,
	dataType: json, 
	data: {
	},
	xhrFields: {
		withCredentials: true
   },
   success: function(resp) {
   }	
   error: function(resp) {
   }	
});
~~~
关键是这里：

~~~javascript
	xhrFields: {
		withCredentials: true
   },
~~~
表示要求浏览器信任本次请求。这时服务端的返回头部必须有：

~~~javascript
Access-Control-Allow-Credentials: true
~~~
否则浏览器为保证安全，将不会把请求的结果传递给请求源脚本。

[参考这里](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Access_control_CORS)
