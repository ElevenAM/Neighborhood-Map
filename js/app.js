var ViewModel = function() {
    var self = this;
    var huntingtonBeach,
        map,
        infowindow,
        bounds;

    // For displayInfo function later down the line
    var dateMap = {
        0: 'Monday',
        1: 'Tuesday',
        2: 'Wednesday',
        3: 'Thursday',
        4: 'Friday',
        5: 'Saturday',
        6: 'Sunday',
    };

    function initialize() {
        //For ease of future reference
        huntingtonBeach = new google.maps.LatLng(33.658, -118.001);
        map = new google.maps.Map(document.getElementById('map-canvas'), {
            center: huntingtonBeach,
            zoom: 18,
            //Changes Map Type into an angled terrain style
            mapTypeId: google.maps.MapTypeId.HYBRID,
            zoomControl: false,
            overviewMapControl: false,
            panControl: false,
            scrollwheel: false,
            streetViewControl: false,
        });
        getAllPlaces();
    }

    //Specifies request and plugs it into a Google Search. Runs Callback when finished
    function getAllPlaces() {
        self.allPlaces([]);
        var request = {
            location: huntingtonBeach,
            radius: 700,
            types: ['food']
        };
        infowindow = new google.maps.InfoWindow();
        service = new google.maps.places.PlacesService(map);
        service.nearbySearch(request, getAllPlacesCallback);
    }

    /*Launched after previous getAllPlacesFunction. Takes the results of the Google
    * requestand adds them to an allPlaces array. Runs instagram request for each location
    */
    function getAllPlacesCallback(results, status) {
        if (status === google.maps.places.PlacesServiceStatus.OK) {
            results.forEach(function (place) {
                place.marker = createMarker(place);
                place.instagrams = ko.observableArray([]);
                place.isGettingInstagrams = ko.observable(true);
                place.isInFilteredList = ko.observable(true);
                self.allPlaces.push(place);
                getInstagrams(place);
            });
        }
    }

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

    function getStreet(address) {
        var firstComma = address.indexOf(',');
        var street = address.slice(0, firstComma) + '.';
        return street;
    }

    function getCityState(address) {
        var firstComma = address.indexOf(',');
        var cityState = address.slice(firstComma + 1);
        cityState = cityState.replace(', United States', '');
        return cityState;
    }

    function getDayofWeek() {
        var date = new Date();
    /*Gets a numeric value for day of the week as specified by earlier dateMap var
    * and matches it with the opening_hours property fo the PlaceResult object
    */
        var today = date.getDay();
        if (today === 0) {
            today = 6;
        } else {
            today -= 1;
        }
        return today;
    }

    function resizePhoto() {
        if ($(window).height() < $(window).width()) {
            self.photoDimensionValue($(window).height() - 160);
        } else {
            self.photoDimensionValue(0.9 * $(window).width());
        }
    }

    // Gets Instagram info and places in a corresponding observable array
    function getInstagrams(place) {
//Double checks a locations name with Instagram's location ID's
        function getLocationIds(results) {
            var locationIds = [];
            var checkName = place.name.toLowerCase().replace(/[^\w]/gi, '');
            var compareName;
            results.data.forEach(function (result) {
                compareName = result.name.toLowerCase().replace(/[^\w]/gi, '');
                if (checkName.indexOf(compareName) !== -1 ||
                    compareName.indexOf(checkName) !== -1) {
                    locationIds.push(result.id);
                }
            });
            return locationIds;
        }

        function getPhotosById(url) {
            var def = $.Deferred();
            $.ajax({
                type: "GET",
                dataType: "jsonp",
                cache: false,
                url: url,
                success: function (results) {
                    results.data.forEach(function (result) {
                        place.instagrams.push(result);
                    });
                    def.resolve();
                }
            });
            return def.promise();
        }

        //Calls getPhotosbyID for each location ID and sorts them in array by likes
        function getAllPhotos(results) {
            var locIds = getLocationIds(results);
            var promises = [];
            locIds.forEach(function (id) {
                var mediaUrl = 'https://api.instagram.com/v1/locations/' + id +
                    '/media/recent?access_token=' + accessToken;
                promises.push(getPhotosById(mediaUrl));
            });

            // Execute function when all Instagram requests are complete.
            $.when.apply($, promises).then(function () {
                clearTimeout(instagramTimeout);
                place.instagrams().sort(function (left, right) {
                    if (left.likes.count > right.likes.count) {
                        return -1;
                    } else if (left.likes.count < right.likes.count) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
                place.isGettingInstagrams(false);
            });
        }

        // Set Timeout in case Instagram data can't be retrieved.
        var instagramTimeout = setTimeout(function () {
            place.isGettingInstagrams(false);
        }, 5000);

        var accessToken = '2013063220.1677ed0.b3cf004364e64025a84e72623fe0aa32';
        var locationUrl = 'https://api.instagram.com/v1/locations/search?lat=' +
            place.geometry.location.lat() + '&lng=' +
            place.geometry.location.lng() + '&distance=50&access_token=' +
            accessToken;

        var locationSearch = $.ajax({
            type: "GET",
            dataType: "jsonp",
            cache: false,
            url: locationUrl
        });

        locationSearch.then(function (data) {
            getAllPhotos(data);
        });
    };

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

    // Currently selected location.
    self.chosenPlace = ko.observable();

    // User input from the search bar.
    self.query = ko.observable('');

    // Break the user's search query into separate words and make them lowercase
    // for comparison between the places in allPlaces.
    self.searchTerms = ko.computed(function () {
        return self.query().toLowerCase().split(' ');
    });

    self.search = function () {
        self.chosenPlace(null);
        infowindow.setMap(null);
        self.allPlaces().forEach(function (place) {
            place.isInFilteredList(false);
            place.marker.setMap(null);
        });
        self.searchTerms().forEach(function (word) {
            self.allPlaces().forEach(function (place) {
                // Finding a match
                if (place.name.toLowerCase().indexOf(word) !== -1 ||
                    place.types.indexOf(word) !== -1) {
                    place.isInFilteredList(true);
                    place.marker.setMap(map);
                }
            })
        });
    };

    self.selectPlace = function (place) {
        if (place === self.chosenPlace()) {
            self.displayInfo(place);
        } else {
            self.filteredPlaces().forEach(function (result) {
                result.marker.setAnimation(null);
            });
            self.chosenPlace(place);
            self.chosenPhotoIndex(0);
            //Make it BOUNCE!
            place.marker.setAnimation(google.maps.Animation.BOUNCE);
            self.displayInfo(place);
        }
    };

    // Boolean to determine whether or not to show the list view.
    self.displayingList = ko.observable(true);

    self.listToggleIcon = ko.computed(function () {
        if (self.displayingList()) {
            //Font Awesome specific classes
            return 'fa fa-minus-square fa-2x fa-inverse';
        }
        return 'fa fa-plus-square fa-2x fa-inverse'
    });

    self.toggleListDisplay = function () {
        if (self.displayingList()) {
            self.displayingList(false);
        } else {
            self.displayingList(true);
        }
    };

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

    // Boolean to determine whether or not to show Instagram photo gallery.
    self.viewingPhotos = ko.observable(false);

    self.togglePhotoDisplay = function () {
        if (self.viewingPhotos()) {
            self.viewingPhotos(false);
            map.setOptions({
                draggable: true
            });
        } else {
            self.viewingPhotos(true);
            map.setOptions({
                draggable: false
            });
        }
        resizePhoto();
    };

    // Observable specifying which photo to display on screen
    self.chosenPhotoIndex = ko.observable(0);

    self.chosenPhotoViewableIndex = ko.computed(function () {
        return self.chosenPhotoIndex() + 1;
    });

    self.chosenPhoto = ko.computed(function () {
        if (self.chosenPlace()) {
            return self.chosenPlace().instagrams()[self.chosenPhotoIndex()];
        }
        return null;
    });

    // Photo's caption on instagram.
    self.captionText = ko.computed(function () {
        if (self.chosenPhoto() && self.chosenPhoto().caption) {
            return self.chosenPhoto().caption.text;
        }
        return 'No Caption';
    });

    self.captionOpacity = ko.observable(1);

    self.toggleCaption = function () {
        if (self.captionOpacity() === 1) {
            self.captionOpacity(0);
        } else {
            self.captionOpacity(1);
        }
    };

    self.nextPhoto = function () {
        if (self.chosenPhotoIndex() !==
            self.chosenPlace().instagrams().length - 1) {
            self.chosenPhotoIndex(self.chosenPhotoIndex() + 1);
        } else {
            self.chosenPhotoIndex(0);
        }
    };

    self.prevPhoto = function () {
        if (self.chosenPhotoIndex() !== 0) {
            self.chosenPhotoIndex(self.chosenPhotoIndex() - 1);
        } else {
            self.chosenPhotoIndex(self.chosenPlace().instagrams().length - 1);
        }
    };

    self.photoDimensionValue = ko.observable();

    // Height and width in pixels for Instagram photo.  For use in data-bind.
    self.photoDimension = ko.computed(function () {
        return self.photoDimensionValue() + 'px';
    });

    self.getInstagramStatus = ko.computed(function () {
        if (self.chosenPlace()) {
            if (self.chosenPlace().instagrams().length != 0 &&
                !self.chosenPlace().isGettingInstagrams()) {
                return 'Click to view recent Instagrams from ' +
                    self.chosenPlace().name;
            }
            if (self.chosenPlace().isGettingInstagrams()) {
                return 'Retrieving Instagrams from ' +
                    self.chosenPlace().name + ' ...';
            }
            if (self.chosenPlace().instagrams().length === 0 &&
                !self.chosenPlace().isGettingInstagrams()) {
                return 'No Instagrams found from ' + self.chosenPlace().name;
            }
        }
        return '';
    });

    initialize();

    window.addEventListener('resize', function (e) {
        map.fitBounds(bounds);
        resizePhoto();
    });

    //Allows arrow key navigation in the instagram viewer
    document.addEventListener('keyup', function (e) {
        if (self.viewingPhotos()) {
            if (e.keyCode === 37) {
                $('.previous-photo').click();
            }
            if (e.keyCode === 39) {
                $('.next-photo').click();
            }
        }
    });

    google.maps.event.addListener(infowindow,'closeclick',function(){
        self.chosenPlace().marker.setAnimation(null);
        self.chosenPlace(null);
    });

    $(function () {
        if ($(window).width() < 650) {
            if (self.displayingList()) {
                self.displayingList(false);
            }
        }
    }());
};

ko.applyBindings(new ViewModel());
