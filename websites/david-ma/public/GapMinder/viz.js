var dataUrl = "data.json";

// wait for the data to be ready and visualise it
d3.json(dataUrl, function(nations){

    // initialise filtered_nations: updateplot the nations that we will be looking at on the page
    var filtered_nations = nations.map(function(nation){
        return nation;
    });

    // create chart area, communicating with the html
    var chart_area = d3.select("#chart_area");

    // computing the sizes of html elements and append them to the page
    var svg_frame = chart_area.append("svg");
    var canvas = svg_frame.append("g");

    var margin = {top: 19.5, right:19.5, bottom: 19.5, left: 39.5};
    var frame_width = 960;
    var frame_height = 350;
    var canvas_width = frame_width - margin.left -margin.right;
    var canvas_height = frame_height - margin.top -margin.bottom;

    svg_frame.attr("width", frame_width);
    svg_frame.attr("height", frame_height);

    canvas.attr("transform", "translate(" +margin.left + ", " +margin.top+")" );

    // define a logarithmic scale (for income) and the domain, orient the axis horizontally 
    var xScale = d3.scale.log().domain([250, 1e5]).range([0, canvas_width]);
    var xAxisGenerator = d3.svg.axis().orient("bottom").scale(xScale);

    // append the axis to the canvas in the right position
    canvas.append("g").attr("class", "x axis")
                    .attr("transform","translate(0," + canvas_height + ")")
                    .call(xAxisGenerator)
                    .append("text")
                    .attr("class", "x label")
                    .attr("text-anchor", "end")
                    .attr("x", canvas_width)
                    .attr("y", - 6)
                    .text("income per capita, inflation-adjusted (dollars)");



    // generate and append y Scale
    var yScale = d3.scale.linear().domain([10, 85]).range([canvas_height, 0]);
    var yAxisGenerator = d3.svg.axis().orient("left").scale(yScale);
    canvas.append("g").attr("class", "y axis")
                    .call(yAxisGenerator)
                    .append("text")
                    .attr("class", "y label")
                    .attr("text-anchor", "end")
                    .attr("y", 6)
                    .attr("dy", ".75em")
                    .attr("transform", "rotate(-90)")
                    .text("life expectancy (years)");

    // define the radius of the circles we want to show 
    var zScale = d3.scale.sqrt().domain([0, 5e8]).range([0, 40]);

    // custom colourscale
   function colScale(region) {
        if (region == "Sub-Saharan Africa") {
            return "#dc39ba";
        } else if (region == "South Asia") {
            return "#72ed87";
        } else if (region == "Middle East & North Africa") {
            return "#3bb6fc";
        } else if (region == "East Asia & Pacific") {
            return "#8e50ff";
        } else if (region == "Europe & Central Asia") {
            return "#f0c731";
        } else {
            return "#ff9449";
        }   
    }

   // function colScale(region) {
   //      if (region == "Sub-Saharan Africa") {
   //          return "#61e0c1";
   //      } else if (region == "South Asia") {
   //          return "#a578ca";
   //      } else if (region == "Middle East & North Africa") {
   //          return "#0923b5";
   //      } else if (region == "East Asia & Pacific") {
   //          return "#62374b";
   //      } else if (region == "Europe & Central Asia") {
   //          return "#f9f4f0";
   //      } else {
   //          return "#158d54";
   //      }   
   //  }

// 61e0c1
// d79774
// 0923b5
// 62374b
// f9f4f0
// 158d54
// a578ca

    // ################# SECOND CHART ################### //


    var line_area = d3.select("#lineplot_area");
    var l_svg_frame = line_area.append("svg");
    var l_canvas = l_svg_frame.append("g");

    var l_margin = {top: 19.5, right:19.5, bottom: 19.5, left: 39.5};
    var l_frame_width = 960;
    var l_frame_height = 350;
    var l_canvas_width = l_frame_width - l_margin.left - l_margin.right;
    var l_canvas_height = l_frame_height - l_margin.top - l_margin.bottom;

    l_svg_frame.attr("width", l_frame_width);
    l_svg_frame.attr("height", l_frame_height);

    l_canvas.attr("transform", "translate(" +l_margin.left + ", " +l_margin.top+")" );

    // define a logarithmic scale (for income) and the domain, orient the axis horizontally 
    var l_xScale = d3.scale.linear().domain([1945, 2013]).range([0, l_canvas_width]);
    var l_xAxisGenerator = d3.svg.axis().orient("bottom").scale(l_xScale);

    // append the axis to the canvas in the right position
    l_canvas.append("g").attr("class", "x axis")
                    .attr("transform","translate(0," + l_canvas_height + ")")
                    .call(l_xAxisGenerator)
                    .append("text")
                    .attr("class", "x label")
                    .attr("text-anchor", "end")
                    .attr("x", l_canvas_width)
                    .attr("y", - 6)
                    .text("year");

    // generate and append y Scale
    var l_yScale = d3.scale.linear().domain([10, 85]).range([l_canvas_height, 0]);
    var l_yAxisGenerator = d3.svg.axis().orient("left").scale(l_yScale);
    l_canvas.append("g").attr("class", "y axis")
                    .call(l_yAxisGenerator)
                    .append("text")
                    .attr("class", "y label")
                    .attr("text-anchor", "end")
                    .attr("y", 6)
                    .attr("dy", ".75em")
                    .attr("transform", "rotate(-90)")
                    .text("life expectancy (years)");

    var l_data_canvas = l_canvas.append("g").attr("class","l_data_canvas");

    // CLEAR ALL BUTTON
    var clear_button = d3.select("#clear_button")
    d3.select("#clear_button").on("click", function(){
        d3.selectAll(".line").remove();
        d3.selectAll(".line_tag").remove();
        d3.selectAll(".dot").style("opacity", 0.7);
    })

    // ################# END SECOND CHART ################### //



    // append the data_canvas to the canvas (data_canvas will contain bubbles)
    var data_canvas = canvas.append("g").attr("class","data_canvas");

    var year_idx = parseInt(document.getElementById("year_slider").value) - 1950;
    document.getElementById("textInput").innerHTML = 'Year:' + (year_idx+1950);



    // SLIDER 
    d3.select("#year_slider").on("input", function(){
        year_idx = parseInt(this.value) - 1950;
        document.getElementById("textInput").innerHTML = 'Year:' + (year_idx+1950);
        updateplot();
    });

    

    var animated = true,
        animate = null;
    function moveAround(){
        year_idx++
        if(year_idx > 58) {
          year_idx = 0;
        }
        document.getElementById("textInput").innerHTML = 'Year:' + (year_idx+1950);
        updateplot();
    }

    d3.select("#toggle_animation").on("click", function(){
      if(animated) {
        animated = false;
        clearInterval(animate);
        d3.select("#toggle_animation").html("Move Around!");
      } else {
        animated = true;
        moveAround();
        d3.select("#toggle_animation").html("Ok stop.");
        animate = setInterval(moveAround, 500);
      }
    });

    // CHECKBOXES
    d3.selectAll(".region_cb").on("change", function() {
        var type = this.value;
        if(this.checked){
            var new_nations = nations.filter(function(nation){
                return nation.region == type;});
            filtered_nations = filtered_nations.concat(new_nations)
        }
        else{
            filtered_nations = filtered_nations.filter(function(nation) {
                return nation.region !=type;
            });
        }
        updateplot()
    })

    // TOGGLE BUTTON
    d3.select("#toggle_button").on("click", function(){
        // var button = document.querySelectorAll("button")[0];
        var button = this;
        var buttonText = button.innerHTML;

        if(buttonText == "linear scale"){
            xScale = d3.scale.linear().domain([-1e4, 1e5]).range([0, canvas_width]);
            xAxisGenerator = d3.svg.axis().orient("bottom").scale(xScale);
            d3.select(".x").call(xAxisGenerator);
            button.innerHTML = "log scale";
        }
        else if (buttonText == "log scale"){
            xScale = d3.scale.log().domain([250, 1e5]).range([0, canvas_width]);
            xAxisGenerator = d3.svg.axis().orient("bottom").scale(xScale);
            d3.select(".x").call(xAxisGenerator);
            button.innerHTML = "linear scale";
        }
        updateplot();

    })


    updateplot()
    function updateplot(){
        
        // binding data             
        var boundObject = data_canvas.selectAll(".dot") 
            .data(filtered_nations, function(d) {return d.name; }); 

        // data entering the workspace
        boundObject.enter().append("circle").attr("class", "dot")
                                .style("fill", function(d){ return colScale(d.region)})
                                .style("opacity", 0.7)
                                // .attr("class", "clicked")
                                .on("mouseover", function(d){
                                    tooltipY.style("visibility","visible").text(d.lifeExpectancy[year_idx]);
                                    tooltipX.style("visibility","visible").text(d.income[year_idx]);
                                    tooltip.style("visibility","visible").text(d.name);
                                    // this.style["opacity"] = "1";
                                 })
                                .on("mouseout", function(d){
                                    tooltipY.style("visibility","hidden");
                                    tooltipX.style("visibility","hidden");
                                    tooltip.style("visibility","hidden").text(d.name);
                                    // this.style["opacity"] = "0.7";
                                 })
                                .on("mousemove", function(){ 
                                    tooltipY.style("top", (d3.event.pageY)+"px")
                                    tooltipX.style("left", (d3.event.pageX)+"px")
                                    tooltip.style("top", (d3.event.pageY -10) + "px" ).style("left", (d3.event.pageX +10) + "px")
                                 })
                                // .on("click", function(d){
                                //         d3.select(this).transition().ease("linear").duration(200).attr("cx", 1000)
                                //         tooltip.text("This was "+ d.name)
                                // })
                                .on("click", function(d){
                                    if (this.style["opacity"] != 1)
                                        {
                                        drawline(d);
                                        this.style["opacity"] = 1}
                                    else {
                                        this.style["opacity"] = 0.7
                                        var id = d.name.replace(/\s+/g, '');
                                        d3.selectAll("#" + id).remove();
                                    }
                                })


        // data exiting the workspace
        boundObject.exit().remove();

        // data transitioning
        boundObject.transition().ease("linear").duration(200)
                                .attr("cx", function(d){ return xScale(d.income[year_idx])})
                                .attr("cy", function(d){ return yScale(d.lifeExpectancy[year_idx])})
                                .attr("r", function(d){ return zScale(d.population[year_idx])});


        // sort by bubble size
        data_canvas.selectAll(".dot")
                    .sort(function (a, b) { return b.population[year_idx] - a.population[year_idx]; });
        }

        // line_area.style("visibility","hidden")
        // clear_button.style("visibility","hidden")



        // create hidden tooltip elements 
        var tooltip = d3.select("#chart_area").append("div").style("position", "absolute").style("visibility", "hidden");
        var tooltipY = d3.select("#chart_area").append("div").style("position", "absolute").style("visibility", "hidden");
        var tooltipX = d3.select("#chart_area").append("div").style("position", "absolute").style("visibility", "hidden");


         function drawline(el){
            console.log(el)
            // var node = d3.select()
                var valueline = d3.svg.line()
                    .x(function(d) { return l_xScale(d[0]); })
                    .y(function(d) { return l_yScale(d[1]); });

                var c = el.years.map(function (d, idx) {
                    return [d, el.lifeExpectancy[idx]];
                });

                var id = el.name.replace(/\s+/g, '');

                chart_area.append("div")
                    .attr("class", "line_tag")    
                    .style("position", "absolute")
                    .style("top", (448+l_yScale(el.lifeExpectancy[58])) +"px")
                    .style("left", l_xScale(2012) +"px")
                    .text(el.name)
                    .style("color", colScale(el.region))
                    .attr("id", id)
                    .style("visibility","hidden");

                var l = l_data_canvas.append("path")
                    .attr("class", "line")
                    .attr("d", valueline(c))
                    .attr("stroke", colScale(el.region))
                    .attr("id", id)
                    .on("mouseover",function(){
                        this.style["stroke-width"] = "5px";
                        d3.selectAll("#"+id).style("visibility","visible");
                    })
                    .on("mouseout",function(){
                        d3.selectAll("#"+id).style("visibility","hidden");
                        this.style["visibility"] = "visible"
                        this.style["stroke-width"] = "2.5px";
                    })
                    ;



                    
            }

        
});

