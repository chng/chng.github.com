# Powerful CMS 主题

## 目录

* 截图   
* 版本
* 无聊的比喻
* 安装使用
	* Git复制   
	* 替换个人信息   
	* 目录树   
	* 本地运行   
	* http://0.0.0.0:4000/   
* 特性  
* 响应式设计  
* 快捷键
* 强大的搜索
	* 开启
	* 搜索设置
	* 模糊匹配
	* 快速跳转
	* ~~拼音搜索~~
	* ~~`Tag` 排序~~
* 图片预览/异步加载
* 说好的细节
* 别人的东西
* To-do-list

## 截图
先放几个截图看一看   
![](http://Sidong.github.io/blog/assets/images/CMS/home.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-lg-2.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-sm-3.png)  

## 版本
目前为 V1.0

## 安装使用
使用这个主题，快速搭建你的blog。  

**Git复制**   

	git clone git@github.com:Sidong/Powerful-CMS.git

**替换个人信息**  

	# 代码高亮，需要安装rdiscount
	markdown: rdiscount
	pygments: true

	# https://github.com/sidong/Powerful-CMS/Permalinks
	# 文章结构 /分类/标题
	permalink:   /:categories/:title/
	url: http://Sidong.github.io/Powerful-CMS
	# 部署在Git上的repo名字
	baseurl: /Powerful-CMS
	# 名字
	author: Sidong
	# 邮箱
	gmail: 'sidongh@gmail.com'
	# 个人logo文件路径
	logo: /assets/images/logo.jpg
	# 站点开始时间
	time: 2014-01-01

	# 个人信息，用于footer
	# contain:github, gmail, twitter, sina; lack:gplus
	contacts:
	  - type: github
	    icon: fa-github
	    url: 'https://github.com/Sidong'
	  - type: gmail
	    icon: fa-pencil
	    url: 'mailto:sidongh@gmail.com'
	  - type: twitter
	    icon: fa-twitter
	    url: 'https://twitter.com/stone_style'
	  - type: sina
	    icon: fa-weibo
	    url: 'http://weibo.com/u/1879863147?s=6uyXnP'

	# 链接，用于导航菜单
	# 包含 about（关于）/articles（文章归档）/tags（标签分类）/feed（feed源）/search（搜索功能）
	links:
	  - title: About
	    url: /about
	    icon: fa-anchor
	    link: normal
	  - title: Articles
	    url: /
	    icon: fa-bookmark
	    link: normal
	  - title: tags
	    url: /tags
	    icon: fa-tags
	    link: normal
	  - title: Feed
	    url: /feed.xml
	    icon: fa-rss-square
	    normalLink: false
	    link: feed
	  - title: Search
	    icon: fa-search
	    normalLink: false
	    link: search

	safe: false
	# Blog标题
	title: Sidong
	# Blog描述
	description: Sidong's Powerful CMS

	# 开启搜索功能
	search: true

	# 开启图片预览功能，未实现，设置为false
	imgPreview: false

	# 多说评论
	comments: false

	# 时间显示
	showTime: true

**目录树**   
将文件夹 `_post` 替换为你的 `_post`，注意图片文件夹路径为 `assets/imgages/`

	.
	├── 404.html  // 404页面
	├── README.md
	├── _config.yml  // 配置文件
	├── _drafts  // 草稿
	├── _includes  // 构成完整页面的页面元素
	│   ├── browser-upgrade.html
	│   ├── disqus_comments.html
	│   ├── footer.html
	│   ├── head.html
	│   ├── imgPreview.html
	│   ├── navigation.html
	│   ├── scripts.html
	│   └── search.html
	├── _layouts  // 模板，其中post文章用post.html模板，其他用page.html模板
	│   ├── page.html
	│   └── post.html
	├── _posts  // 个人文章
	│   ├── 2014-01-01-about.md
	│   └── ...
	├── _site
	├── assets
	│   ├── css  // css文件
	│   │   ├── font-awesome.css
	│   │   ├── highlight.css
	│   │   ├── main.css
	│   │   ├── normalize.css
	│   │   └── typo.css
	│   ├── fonts  // FontAwesome字体文件
	│   │   ├── FontAwesome.otf
	│   │   ├── fontawesome-webfont.eot
	│   │   ├── fontawesome-webfont.svg
	│   │   ├── fontawesome-webfont.ttf
	│   │   └── fontawesome-webfont.woff
	│   ├── images  // 图片目录
	│   │   └── logo.jpg  // 个人logo
	│   └── js  // js文件
	│       ├── jekyll-search.js
	│       ├── main.js
	│       ├── pinyin.js
	│       ├── plugins.js
	│       ├── util.js
	│       └── vendor
	│           ├── jquery-1.11.0.min.js
	│           └── modernizr-2.7.1.min.js
	├── crossdomain.xml
	├── favicon.ico
	├── feed.xml
	├── index.html  // 首页
	├── search.json  // post数据库
	└── tag.html  // tag页面

**本地运行**   
注意在本地运行，将 `site.baseurl` 设置为空，`&` 为在后台运行，不中断终端使用，使用linux `jobs` 目录管理后台   

	jekyll serve --baseurl '' --watch --port 4000 &   

**http://0.0.0.0:4000/**   
![](http://Sidong.github.io/blog/assets/images/CMS/home.png)  

## 特性
设计这个主题，（部分）实现以下特征：   

* 响应式设计（欢迎帮助测试）   
* HTML5语义标签   
* 简洁的设计   
* 快速搜索   
* 在搜索结果中快速跳转   
* 自定义搜索条件（可以基于日期、标题、标签等搜索）   
* 自定义搜索结果模糊匹配   
* ~~增加拼音搜索匹配~~
* 搜索结果利用方向键快速移动   
* 搜索结果Enter在原窗口跳转，Opt+Enter打开新窗口跳转（有些浏览器需要用户允许）   
* 快捷键呼出功能，`.` 呼出菜单，`,` 呼出搜索栏   
* 配置文件可开启/关闭搜索功能   
* 修改配置文件快速替换成你的blog   
* 代码高亮  

## 响应式设计
**大**  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-lg-1.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-lg-2.png)  
**中**
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-mid.png)  
**小**
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-sm-1.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-sm-2.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-sm-3.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/rwd-sm-4.png)  

## 快捷键
在当前页面试试按下 `.` 呼出菜单，按下 `,` 呼出搜索。当然菜单和搜索页提供鼠标点击呼出。点击左上角呼出菜单，点击菜单 <i class='fa fa-search fa-lg'></i> `search` 项目呼出搜索。点击 <i class='fa fa-times fa-lg'></i> 关闭对应的菜单/搜索界面。在搜索界面，按下 `ESC` 关闭搜索界面。   

## 强大的搜索
**开启**   
首先记得在 `_config.yml` 开启搜索功能   

	search: true   

**搜索设置**   
在文件 `scripts.html` 进行搜索设置   

	window.JekyllSearch.init(
	{ 
	  // 搜索输入框元素
	  searchInput: document.querySelector(".search-field"),
	  // 数据库文件路径
	  jsonFile: '/search.json',
	  // 替换模板{xx}
	  template: "<li><article><a href='{url}'><i class='fa fa-share'></i> {title}<span class='entry-date'><time datetime='{date}'>{date}</time></span></a></article></li>",
	  // 搜索结果元素
	  searchResults: document.querySelector(".search-results"),
	  // 搜索结果标题
	  searchResultsHeader: "<h4>Search results</h4>",
	  // 搜索项目数量
	  limit: 12,
	  // 模糊匹配
	  fuzzy: true,
	  // 无搜索结果提示
	  noResults: "<p>Nothing matched your query</p>",
	  // 搜索要匹配项目，与search.json对应，这里只搜索标题和日期
	  matchItems: {'title':true,'category':false,'date':true}
	});

**模糊匹配**   

* `js` 能够匹配任意包含字符 `j` 和 `s` 的项目，`j` 一定要在 `s` 前面   
* `.` 可指代任意字符，`..........` 匹配包含长度大于等于10个字符的项目   

**快速跳转**  

在搜索结果中，按方向键 `↑` 和 `↓` 可以选择项目，按下 `Enter` 键在当前窗口跳转至选择的项目（不会跳到鼠标在项目上引发的高亮），按下 `Opt` + `Enter` 会在新窗口打开页面。  

**~~拼音搜索~~**   
:( 还没实现。   

**~~`Tag` 排序~~**   
:( 搜索结果按 `Tag` 排序，还没实现！  

## 图片预览/异步加载
:( 还没想好怎么实现！   

## 说好的细节
**@one**   
每次进入搜索界面，都会自动对焦文本输入框，并且文本输入框文本自动全选，方便下一次搜索。   
![](http://Sidong.github.io/blog/assets/images/CMS/tip-1.png)  

**@two**   
在按下方向键 `↑` 和 `↓` 选择结果时，屏蔽方向键默认移动文本光标，但是 `←` `→` 可以控制文本光标移动。  
![](http://Sidong.github.io/blog/assets/images/CMS/tip-2.png)  

**@three**   
退出搜索后，再次进入搜索状态保持着。   
![](http://Sidong.github.io/blog/assets/images/CMS/tip-3.png)  

**@four**   
所有的快捷键均有实体按钮支持。   
![](http://Sidong.github.io/blog/assets/images/CMS/btn-1.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/btn-2.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/btn-3.png)  

**@five**   
每一篇文章都在右上角给出描述、日期、标签、作者。  
并且支持多标签支持，点击标签前往标签分类。如本文：   
![](http://Sidong.github.io/blog/assets/images/CMS/tag-1.png)  
![](http://Sidong.github.io/blog/assets/images/CMS/tag-2.png)
:( ~~标签排序~~    

## 别人的东西
借鉴了，感谢!

* [FontAsesome](http://fortawesome.github.io/Font-Awesome/)   
* [Simple-Jekyll-Search](https://github.com/christian-fei/Simple-Jekyll-Search)  
* [typo.css](http://typo.sofish.de/)  

## To-do-list

* 完成<a href="#id-3">特性</a>未完成的任务。   
* 重构css文件。  

这只是一个初稿，本项目还在更新中。欢迎拍砖。   
