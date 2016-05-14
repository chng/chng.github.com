// some fix;
window.JekyllSearch = (function(window,document){
	var searchInput = document.querySelector(".search"),
		jsonFile = "/search.json",
		jsonData = null,
		template = "<a href='{url}' title='{desc}'>{title}</a>",
		searchResults = document.querySelector(".results"),
		searchResultsHeader = "<h4>Search results</h4>",
		limit = 12,
		fuzzy = false,
		noResults = "<p>Nothing matched your query</p>",
		matchItems = {'title':true,'category':false};

	var oldValue = '';

	/*
		register the keydown event and load the json file
	*/
	function load(){
		if( searchInput && searchResults ){
			getJSON();
			// 按键停止.5s才开始搜索
			window.EventUtil.addHandler(searchInput, 'keyup', search);
			// 阻止上下键对文本光标位置的改变
			window.EventUtil.addHandler(searchInput, 'keydown', stopUpandDown);
		}else{
			console.log("couldn't find the searchInput or searchResults element");
		}
	}
	// 阻止上下键对文本光标位置的改变
	function stopUpandDown(e) {
		if (e.which == 38 || e.which == 40) {
			window.EventUtil.preventDefault(e);
		}
	}

	/*
		Fetches the JSON file and populate the jsonData var
	*/
	function getJSON(){
		var xhr = (window.XMLHttpRequest) ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
		xhr.open("GET", jsonFile, true);
		xhr.onreadystatechange = function(){
			if (xhr.status==200 && xhr.readyState==4){
				try{
					jsonData = JSON.parse( xhr.responseText );
					console.log( "data loaded successfully" );
				}catch(err){
					console.log( err );
					jsonData = null;
				}
			}
		}
		xhr.send();
	}

	/*
		Perform a search on the keydown event
		e is passed from the event listener to determine which key the user pressed
	*/
	function search( e ){
		if(e.which === 13 && matches && matches.length){
			// Enter在当前窗口前往页面，Enter+Opt在新窗口打开页面
			if (e.altKey) window.open(searchResults.querySelector('li.active a').href);
			else window.location = searchResults.querySelector('li.active a').href;
		} else if (e.which === 38) {
			// 上一个li选项；
			window.EventUtil.preventDefault(e);
			var li = searchResults.querySelector('li.active');
			if (li.previousElementSibling.nodeName.toLowerCase() == 'li') {
				classie.removeClass(li,'active');
				classie.addClass(li.previousElementSibling,'active');
			}
		} else if (e.which === 40) {
			// 下一个li选项；
			window.EventUtil.preventDefault(e);
			// console.log(searchResults.querySelector('li.active'));
			var li = searchResults.querySelector('li.active');
			if (li.nextElementSibling.nodeName.toLowerCase() == 'li') {
				classie.removeClass(li,'active');
				classie.addClass(li.nextElementSibling,'active');
			}
		} else if (oldValue != e.target.value) {
			if(jsonData){
				oldValue = e.target.value;
				writeMatches( getMatches( e.target.value ) );
			}else{
				console.log( "jsonData is not ready" );
				searchResults.innerHTML = "jsonData is not ready";
			}
		}
	}
	/*
		Get matches that satisfy the query
	*/
	function getMatches( query ){
		matches = [];
		for (var i = 0; i < jsonData.length; i++) {
			var obj = jsonData[i];
			for (key in obj) {
				if( fuzzy ){
					var regexp = new RegExp( query.split('').join('.*?'), 'gi');
					if( matchItems[key] && obj[key].match(regexp) ){
						matches.push(obj);
						break;
					}
				}else if (obj.hasOwnProperty(key) 
					&& obj[key].toLowerCase().indexOf(query.toLowerCase()) >= 0
					&& matchItems[key]){
					// console.log(obj[key])
					matches.push(obj);
					break;
				}
			}
		}
		// console.log(matches);
		return matches;
	}

	/*
		Write out the matches
	*/
	function writeMatches( matches ){
		searchResults.innerHTML = searchResultsHeader;
		if( matches && matches.length ){
			for (var i = 0; i < matches.length &&  i < limit; i++) {
				var match = matches[i];
				var output = template.replace(/\{(.*?)\}/g, function(m, capturedGroup) {
					return match[ capturedGroup ];
				});
				searchResults.innerHTML += output;
			}
		}else{
			searchResults.innerHTML = searchResultsHeader + noResults;		
		}
		// console.log("write");
		setFirstActive();
	}

	// every time results come up, set the first li active;
	function setFirstActive() {
		var first = searchResults.querySelector('li')
		if (first != null) {
			classie.addClass(first, 'active');
		}
	}

	return {
		init: function(options){
			if( options ){
				searchInput = options.searchInput || searchInput;
				jsonFile = options.jsonFile || jsonFile;
				template = options.template || template;
				searchResults = options.searchResults || searchResults;
				searchResultsHeader = options.searchResultsHeader || searchResultsHeader;
				limit = options.limit || limit;
				fuzzy = options.fuzzy || fuzzy;
				noResults = options.noResults || noResults;
				matchItems = options.matchItems || matchItems;
			}
			load();
		}
	}
})(window,document);
