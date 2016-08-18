var done = false;
var csv_data = null;

$.get('http://data.gov.au/dataset/3fd356c6-0ad4-453e-82e9-03af582024c3/resource/d73f2a2a-c271-4edd-ac45-25fd7ad2241f/download/localphotostories20092014csv.csv', function(data) {
  csv_data = Papa.parse(data);
  done = true;
});

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function add_rand_photo() {
  if (done) {
    // Choose an image at random
    var idx = getRandomInt(1, csv_data.data.length);
    // Display it
    show_image(csv_data.data[idx][3], "Image number " + idx);
  } else {
    alert("Sorry, still loading");
  }
}

function show_image(src, alt) {
  var img = document.createElement("img");
  img.src = src;
  // img.width = width;
  // img.height = height;
  img.alt = alt;
  document.body.appendChild(img);
}

// Load the XML
// Follow the link to the original article
// Extract the DC and OpenGraph from the <meta> tags
