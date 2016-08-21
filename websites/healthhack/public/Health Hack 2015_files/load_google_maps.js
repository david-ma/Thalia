function initialize(lat, lng) {
    var mapCanvas = document.getElementById('map-canvas');
    var mapOptions = {
        center: new google.maps.LatLng(lat,lng),
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    }
    var map = new google.maps.Map(mapCanvas, mapOptions)
    
    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(lat,lng),
        map: map,
        title: 'Hello World!'
    });

    google.maps.event.addDomListener(window, "resize", function() {
        var center = new google.maps.LatLng(lat,lng);
        google.maps.event.trigger(map, "resize");
        map.setCenter(center);
    });
}
;
