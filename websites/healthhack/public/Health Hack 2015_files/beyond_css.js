equalheight = function(container) {
    // make a collection of containers all the same height
    var currentTallest = 0,
        currentRowStart = 0,
        rowDivs = new Array(),
        $el,
        topPosition = 0;
    
    $(container).each(function() {
        var $el = $(this);
        $($el).height('auto');
        topPostion = $el.position().top;

        if (currentRowStart != topPostion) {
            for (currentDiv = 0 ; currentDiv < rowDivs.length ; currentDiv++) {
                rowDivs[currentDiv].height(currentTallest);
            }
            rowDivs.length = 0; // empty the array
            currentRowStart = topPostion;
            currentTallest = $el.height();
            rowDivs.push($el);
        } else {
            rowDivs.push($el);
            currentTallest = (currentTallest < $el.height()) ? ($el.height()) : (currentTallest);
        }
        for (currentDiv = 0 ; currentDiv < rowDivs.length ; currentDiv++) {
            rowDivs[currentDiv].height(currentTallest);
        }
    });
};

centrewithin = function(container) {
    // vertically center the first div within another div using margins
    $(container).each(function() {
        var $outer = $(this);
        var $inner = $outer.children().first();
        var $mrg = ($outer.height() - $inner.height())/2;
        $($inner.children()[1]).css('margin-top',$mrg+'px');
    });
};

load_sponsors = function(load_data, names, site_name, page_type) {
    // keep count of sponsor types so we know which decorators to remove
    var type_counts = {
                        "national-gold" : 0,
                        "national-silver" : 0,
                        "community-gold" : 0,
                        "community-silver" : 0,
                        "community-standard" : 0
                      }
    if  (load_data) {
        $.get("./data/sponsors.json", function(data) {
            var sn = site_name.toLowerCase();
            $.each(names, function(index, s_name) {
                var sponsor_data = data[s_name];
                $("#"+s_name+"-href").attr("href", sponsor_data["href"]);
                var $img = $("#"+s_name+"-img"); 
                $img.attr("alt", sponsor_data["displayName"]);
                $img.attr("src", "./images/sponsors/" + sponsor_data["img"]);
                if("logos_only" == page_type) {
                    // remove decorators
                    $.each($(".sponsor-grouping"), function(index, dec) {
                        dec.remove();
                    });
                    // only allow gold, platinum or national sponsors on the main small logos section
                    if("gold" == sponsor_data["type"] || "platinum" == sponsor_data["type"]) {
                        $("#"+s_name+"-img-div").addClass("sponsor-logo-img-div");      // half width logos
                        $("#"+s_name+"-block").addClass("col-xs-12"); 
                        type_counts[sponsor_data["scope"]+"-"+sponsor_data["type"]] ++;
                    } else {
                        $("#"+s_name+"-block").remove();
                    }
                } else {
                    if ("location" == page_type && -1 == sponsor_data["location"].indexOf(sn)) {
                        $("#"+s_name+"-block").remove();
                    } else {
                        var $img_div = $("#"+s_name+"-img-div");         
                        $img_div.addClass("sponsor-img-div");
                        $("#"+s_name+"-block").addClass("col-xs-12");
                        var $text_div = $("<div>", { "html": sponsor_data["text"], "class": "sponsor-logo-text-div" });
                        $text_div.insertAfter($img_div);
                        type_counts[sponsor_data["scope"]+"-"+sponsor_data["type"]] ++;
                    }
                }
            });
            // remove any un-needed decorators 
            $.each(type_counts, function(cls, count) {
                if(0 == count) {
                    $("#decorator-"+cls).remove();
                }
            });
            equalheight('.sponsor-block-cn');
            //centrewithin('.sponsor-block-cn');
        });

    } else {
        equalheight('.sponsor-block-cn');
        //centrewithin('.sponsor-block-cn');
    }
};

load_custom_faqs = function(scope, site_name, faq_data) {
    if (0 != faq_data[scope].length) {
        var $target = $("#"+scope+"-faq");
        if("site" == scope) {
            // put the main header in for this site
            $target.append($("<h3>", { html: "Frequently Asked Questions - For " + site_name }));
            $target.append($("<br>"));
        }
        $.each(faq_data[scope], function(idx, faq) {
            $target.append($("<h4>", { html: faq[0] }));
            $target.append($("<p>", { html: faq[1] }));
            $target.append($("<br>"));
        });
    } 
};
