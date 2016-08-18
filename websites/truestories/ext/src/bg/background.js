// if you checked "fancy-settings" in extensionizr.com, uncomment this lines

var settings = new Store("settings", {
    "sample_setting": "This is how you use Store.js to remember values"
});


//example of using a message handler from the inject scripts
// chrome.extension.onMessage.addListener(
//   function(request, sender, sendResponse) {
//   	console.log("ehllo");
//   	chrome.pageAction.show(sender.tab.id);
//     sendResponse("asdf");
//   });
//   
//   
// 
// localStorage.hello = 123;
// 


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log(sender.tab ?
                "from a content script:" + sender.tab.url :
                "from the extension");
    if (request.greeting == "hello")
      sendResponse({farewell: "goodbye"});
  });



