var ViewModel = function() { //Note that I haven't closed this function yet.
  var self = this;
  this.categories = ko.observableArray();
  this.imgSrc = ko.observable(img/someimage.jpg)

    function initialize() {
      var mapOptions = {
        center: { lat: 33.658, lng: -118.001},
        zoom: 18,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        zoomControl: false,
        draggable: false,
        overviewMapControl: false,
        panControl: false,
        scrollwheel: false,
        streetViewControl: false,
      };
      var map = new google.maps.Map(document.getElementById('map-canvas'),
          mapOptions);
    }
    google.maps.event.addDomListener(window, 'load', initialize);

ko.applyBindings(new ViewModel());

    // An array that will contain all places that are initially retrieved by
    // the getAllPlaces function.
    self.allPlaces = ko.observableArray([]);

    // Array derived from allPlaces.  Contains each place that met the search
    // criteria that the user entered.
    self.filteredPlaces = ko.computed(function () {
        return self.allPlaces().filter(function (place) {
            return place.isInFilteredList();
        });
    });

    /**
     * Creates the map and sets the center to Boston.  Then gets popular
     * restaurants and bars in the area.
     */
    function initialize() {
        huntingtonBeach = new google.maps.LatLng(36.660590, -117.996655);
        map = new google.maps.Map(document.getElementById('map-canvas'), {
            center: huntingtonBeach,
            zoom: 14,
            disableDefaultUI: true
        });
        getAllPlaces();
    }

    /**
     * Makes a request to Google for popular restaurants and bars in Boston.
     * Executes a callback function with the response data from Google.
     */
    function getAllPlaces() {
        self.allPlaces([]);
        var request = {
            location: huntingtonBeach,
            radius: 500,
            types: ['food', 'bar', 'cafe']
        };
        infowindow = new google.maps.InfoWindow();
        service = new google.maps.places.PlacesService(map);
        service.nearbySearch(request, getAllPlacesCallback);
    }

        /**
     * Gets resulting places from getAllPlaces Google request.  Adds additional
     * properties to the places and adds them to the allPlaces array.  Begins
     * an Instagram request to get recent media for this location.  The results
     * of that request will be stored in the place's instagram array created
     * in this function.
     * @param {Array.<Object>} results Array of PlaceResult objects received
     *      in response to getAllPlaces' request.
     * @param {string} status String indicating status of getAllPlaces request.
     */
    function getAllPlacesCallback(results, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            // Create new bounds for the map.  Will be updated with each new
            // location.  This will be used to make sure all markers are
            // visible on the map after the search.
            bounds = new google.maps.LatLngBounds();
            results.forEach(function (place) {
                place.marker = createMarker(place);
                /**
                 * Array to store data from Instagram API request.  Array
                 * is observable so data can be stored and accessed after
                 * this place is pushed to the allPlaces array.  This way
                 * the page can load and doesn't have to wait for data from
                 * Instagram.
                 * @type {Array.<Object>}
                 */
                place.instagrams = ko.observableArray([]);
                /**
                 * Property that is true if the getInstagrams function is still
                 * running for this place.  Used to distinguish difference
                 * places with no Instagram data and places that are still
                 * in the process of getting the data.
                 * @type: {boolean}
                 */
                place.isGettingInstagrams = ko.observable(true);
                /**
                 * If property is true, place will be included in the
                 * filteredPlaces array and will be displayed on screen.
                 * Initially, all places will be in the filteredPlaces Array.
                 * @type {boolean}
                 */
                place.isInFilteredList = ko.observable(true);
                self.allPlaces.push(place);
                getInstagrams(place);
                bounds.extend(new google.maps.LatLng(
                    place.geometry.location.lat(),
                    place.geometry.location.lng()));
            });
            // Done looping through results so fit map to include all markers.
            map.fitBounds(bounds);
        }
    }

        /**
     * Takes a PlaceResult object and puts a marker on the map at its location.
     * @param {Object} place A PlaceResult object returned from a Google Places
     *   Library request.
     * @return {Object} marker A Google Maps Marker objecte to be placed on the
     *   map.
     */
    function createMarker(place) {
        var marker = new google.maps.Marker({
            map: map,
            position: place.geometry.location,
        });
        // When a marker is clicked scroll the corresponding list view element
        // into view and click it.
        google.maps.event.addListener(marker, 'click', function () {
            document.getElementById(place.id).scrollIntoView();
            $('#' + place.id).trigger('click');
        });
        return marker;
    }

    /**
     * Takes an address (in this case a place's formatted_address property) and
     * returns just the street.
     * @param {string} address The location's full address.
     * @param {string} street The locations street.
     */
    function getStreet(address) {
        var firstComma = address.indexOf(',');
        var street = address.slice(0, firstComma) + '.';
        return street;
    }

    /**
     * Takes an address (in this case a place's formatted_address property) and
     * returns just the city and state.
     * @param {string} address The location's full address.
     * @param {string} street The locations city and state.
     */
    function getCityState(address) {
        var firstComma = address.indexOf(',');
        var cityState = address.slice(firstComma + 1);
        cityState = cityState.replace(', United States', '');
        return cityState;
    }

        /*
     * Executes a getDetails request for the selected place and displays the
     * infowindow for the place with the resulting information.
     * @param {Object} place A PlaceResult object.
     */
    self.displayInfo = function (place) {
        var request = {
            placeId: place.place_id
        };
        service.getDetails(request, function (details, status) {
            // Default values to display if getDetails fails.
            var locName = '<h4>' + place.name + '</h4>';
            var locStreet = '';
            var locCityState = '';
            var locPhone = '';
            var locOpenHours = '';
            if (status == google.maps.places.PlacesServiceStatus.OK) {
                if (details.website) {
                    // Add a link to the location's website in the place's name.
                    locName = '<h4><a target="_blank" href=' + details.website +
                        '>' + place.name + '</a></h4>';
                }
                if (details.formatted_phone_number) {
                    locPhone = '<p>' + details.formatted_phone_number + '</p>';
                }
                if (details.formatted_address) {
                    locStreet = '<p>' + getStreet(
                        details.formatted_address) + '</p>';
                    locCityState = '<p>' + getCityState(
                        details.formatted_address) + '<p>';
                }
                var today = getDayofWeek();
                if (details.opening_hours &&
                    details.opening_hours.weekday_text) {
                    openHours = details.opening_hours.weekday_text[today];
                    openHours = openHours.replace(dateMap[today] + ':',
                        "Today's Hours:");
                    locOpenHours = '<p>' + openHours + '</p>';
                }
            }
            var content = '<div class="infowindow">' + locName + locStreet +
                locCityState + locPhone + locOpenHours + '</div>';
            infowindow.setContent(content);
            infowindow.open(map, place.marker);
            map.panTo(place.marker.position);
        })
    };

        // When the window is resized, update the size of the displayed photo and
    // make sure the map displays all markers.
    window.addEventListener('resize', function (e) {
        map.fitBounds(bounds);
        resizePhoto();
    });

    initialize();


    // When infowindow is closed, stop the marker's bouncing animation and
    // deselect the place as chosenPlace.
    google.maps.event.addListener(infowindow,'closeclick',function(){
        self.chosenPlace().marker.setAnimation(null);
        self.chosenPlace(null);
    });

ko.applyBindings(new appViewModel());
