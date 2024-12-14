var map, marker_s, marker_e, marker_p;
var listMarkerArr = [];
var MarkerArr = [];
var startPosition = null;
var endPosition = null;
var gps_waypoint_array = []; // waypoint 배열
var turnType_array = [];  // TurnType 배열
var distance_array = [];
var linedrawArr = []; // 경로 그리기 배열
const ros = new ROSLIB.Ros();
var waypoints = []; //WaypointArray.msg 안에 들어갈 waypoints[]

// ROS 연결
ros.connect('ws://localhost:9090');

ros.on('error', (error) => {
    console.log(error);
});

ros.on('connection', (error) => {
    console.log('Connection: ok!');
});

ros.on('close', (error) => {
    console.log('Connection closed.');
});

const topic = new ROSLIB.Topic({
    ros: ros,
    name: '/waypoint',
    messageType: 'custom_msg_package/WaypointArray'
});

function waypoint_push(x, y, turnType, distance) {
    waypoints.push({
        x: x,
        y: y,
        turn_type: turnType,
        distance: distance
    })
}

function publish() {
    let header = {
        stamp: {
            sec: Math.floor(Date.now() / 1000),
            nanosec: (Date.now() % 1000) * 1e6
        },
        frame_id: "map" // 좌표계 이름
    };
    let msg = new ROSLIB.Message({
        header: header,
        waypoints: waypoints
    });
    topic.publish(msg);
}

function initTmap() {
    // 지도 띄우기
    map = new Tmapv2.Map("map_section", { //map_div
        center: new Tmapv2.LatLng(37.56520450, 126.98702028),
        width: "100%", //70%
        height: "50vh", //400px
        zoom: 17,
        zoomControl: true,
        scrollwheel: true
    });

    // 출발지 검색 엔터로 동작
    $("#searchStart").keypress(function (e) {
        if (e.keyCode === 13) {
            searchLocation('start')
        }
    });

    // 도착지 검색 엔터로 동작
    $("#searchEnd").keypress(function (e) {
        if (e.keyCode === 13) {
            searchLocation('end')
        }
    });

    // 출발지 검색 버튼 클릭
    $("#btn_select_start").click(function () {
        searchLocation('start')
    });

    // 도착지 검색 버튼 클릭
    $("#btn_select_end").click(function () {
        searchLocation('end')
    });

    // 길찾기 버튼 클릭
    $("#btn_find_route").click(function () {
        if (startPosition && endPosition) {
            findRoute(startPosition, endPosition);
        } else {
            alert("출발지와 도착지를 모두 선택해주세요.");
        }
    });


}

function searchLocation(type) {
    var searchKeyword;
    if (type === 'start') {
        searchKeyword = $('#searchStart').val();
    } else {
        searchKeyword = $('#searchEnd').val();
    }

    var text = searchKeyword.trim().toLowerCase();


    if (text.includes("대양 ai") || text.includes("대양ai") || text.includes("대양a")) {
        let innerHtml = "<li data-lat='37.550421646492495' data-lng='127.07584368629597' data-name='세종대학교 대양AI센터'>" +
            "<button class='btn_select' data-type='" + type + "'>선택</button>" +
            "<img src='https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_b_m_" + 0 + ".png' style='vertical-align:middle;'/>" +
            "<span>세종대학교 대양AI센터</span>" +
            "</li>";

        // 검색 결과 목록에 추가

        $("#searchResult").html(innerHtml); // 검색 결과를 HTML에 삽입

        // 출발지 또는 도착지 선택 이벤트 처리
        $(".btn_select").click(function () {
            var selectedLat = $(this).parent().data('lat');
            var selectedLng = $(this).parent().data('lng');
            var selectedName = $(this).parent().data('name');
            var locationType = $(this).data('type');

            if (locationType === 'start') {
                startPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
                $("#searchStart").val(selectedName);  // 출발지 입력란에 선택된 장소 이름 입력
            } else {
                endPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
                $("#searchEnd").val(selectedName);  // 도착지 입력란에 선택된 장소 이름 입력
            }

            $("#searchResult").html("");
        });

        return;
    }


    var headers = {};
    headers["appKey"] = "nQev4Gnamg53zSwXItuHK4HnbaFL5Ho7740Jx8hX";

    $.ajax({
        method: "GET",
        headers: headers,
        url: "https://apis.openapi.sk.com/tmap/pois?version=1&format=json&callback=result",
        async: false,
        data: {
            "searchKeyword": searchKeyword,
            "resCoordType": "EPSG3857",
            "reqCoordType": "WGS84GEO",
            "count": 10
        },
        success: function (response) {
            var resultpoisData = response.searchPoiInfo.pois.poi;

            // 기존 마커 제거
            if (MarkerArr.length > 0) {
                for (var i in MarkerArr) {
                    MarkerArr[i].setMap(null);
                }
                MarkerArr = [];
            }

            // 경로(선) 그리기 초기화            
            if (linedrawArr.length > 0) {
                for (var i in linedrawArr) {
                    linedrawArr[i].setMap(null);
                }
                linedrawArr = [];
            }

            var innerHtml = "";
            var positionBounds = new Tmapv2.LatLngBounds(); // 맵에 결과물 확인을 위한 LatLngBounds 객체 생성

            for (var k in resultpoisData) {
                var frontLat = Number(resultpoisData[k].frontLat);
                var frontLon = Number(resultpoisData[k].frontLon);
                var name = resultpoisData[k].name;

                var pointCng = new Tmapv2.Point(frontLon, frontLat);
                var projectionCng = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(pointCng);

                var lat = projectionCng._lat;
                var lng = projectionCng._lng;

                var markerPosition = new Tmapv2.LatLng(lat, lng);
                //map.setCenter(markerPosition);


                // 첫 번째 검색 결과 위치로 지도 이동
                if (k == 0) {
                    map.setCenter(markerPosition);
                }

                // 마커 추가
                var marker = new Tmapv2.Marker({
                    position: markerPosition,
                    icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_b_m_" + k + ".png",
                    map: map
                });
                listMarkerArr.push(marker); // 마커 배열에 추가

                // 검색 결과 목록에 추가
                innerHtml += "<li data-lat='" + lat + "' data-lng='" + lng + "' data-name='" + name + "'>" +
                    "<button class='btn_select' data-type='" + type + "'>선택</button>" +
                    "<img src='https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_b_m_" + k + ".png' style='vertical-align:middle;'/>" +
                    "<span>" + name + "</span>" +
                    "</li>";

                positionBounds.extend(markerPosition); // LatLngBounds 객체 확장
            }

            $("#searchResult").html(innerHtml); // 검색 결과를 HTML에 삽입
            map.panToBounds(positionBounds); // 확장된 bounds의 중심으로 이동시키기

            // 출발지 또는 도착지 선택 이벤트 처리
            $(".btn_select").click(function () {
                var selectedLat = $(this).parent().data('lat');
                var selectedLng = $(this).parent().data('lng');
                var selectedName = $(this).parent().data('name');
                var locationType = $(this).data('type');

                if (locationType === 'start') {
                    startPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
                    $("#searchStart").val(selectedName);  // 출발지 입력란에 선택된 장소 이름 입력
                    
                    /*var pointCng = new Tmapv2.Point(selectedLng, selectedLat);
                    var projectionCng = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(pointCng);

                    var lat = projectionCng._lat;
                    var lng = projectionCng._lng;

                    var markerPosition = new Tmapv2.LatLng(lat, lng);
                    map.setCenter(markerPosition);
                    marker_s = new Tmapv2.Marker({
                        position: markerPosition,
                        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_s.png",
                        iconSize: new Tmapv2.Size(24, 38),
                        map: map
                    });*/
                    if (marker_s){
                        marker_s.setMap(null);
                    }

                    marker_s = new Tmapv2.Marker({
                        position: new Tmapv2.LatLng(startPosition.lat, startPosition.lng),
                        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_s.png",
                        iconSize: new Tmapv2.Size(24, 38),
                        map: map
                    });
                    
                } else {
                    endPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
                    $("#searchEnd").val(selectedName);  // 도착지 입력란에 선택된 장소 이름 입력

                    /*var pointCng = new Tmapv2.Point(selectedLng, selectedLat);
                    var projectionCng = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(pointCng);

                    var lat = projectionCng._lat;
                    var lng = projectionCng._lng;

                    var markerPosition = new Tmapv2.LatLng(lat, lng);
                    map.setCenter(markerPosition);
                    marker_e = new Tmapv2.Marker({
                        position: markerPosition,
                        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_e.png",
                        iconSize: new Tmapv2.Size(24, 38),
                        map: map
                    });*/
                    if (marker_e){
                        marker_e.setMap(null);
                    }

                    marker_e = new Tmapv2.Marker({
                        position: new Tmapv2.LatLng(endPosition.lat, endPosition.lng),
                        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_e.png",
                        iconSize: new Tmapv2.Size(24, 38),
                        map: map
                    });
                    //listMarkerArr.push(marker_e); // 마커 배열에 추가
                }

                $("#searchResult").html("");

                // 기존 마커 제거
                if (listMarkerArr.length > 0) {
                    for (var i in listMarkerArr) {
                        listMarkerArr[i].setMap(null);
                    }
                    listMarkerArr = [];
                }

            });
        },
        error: function (request, status, error) {
            console.log("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
        }
    });
}



function findRoute(startPosition, endPosition) {
    var headers = {};
    headers["appKey"] = "nQev4Gnamg53zSwXItuHK4HnbaFL5Ho7740Jx8hX";

    var routeBounds = new Tmapv2.LatLngBounds();

    /*// 기존 마커 제거
    if (listMarkerArr.length > 0) {
        for (var i in listMarkerArr) {
            listMarkerArr[i].setMap(null);
        }
        listMarkerArr = [];
    }*/
    
    /*
    // 출발지 마커
    marker_s = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(startPosition.lat, startPosition.lng),
        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_s.png",
        iconSize: new Tmapv2.Size(24, 38),
        map: map
    });

    // 도착지 마커
    marker_e = new Tmapv2.Marker({
        position: new Tmapv2.LatLng(endPosition.lat, endPosition.lng),
        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_e.png",
        iconSize: new Tmapv2.Size(24, 38),
        map: map
    });
    */

    
    $.ajax({
        method: "POST",
        headers: headers,
        url: "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&callback=result",
        async: false,
        data: {
            "startX": startPosition.lng,
            "startY": startPosition.lat,
            "endX": endPosition.lng,
            "endY": endPosition.lat,
            "reqCoordType": "WGS84GEO",
            "resCoordType": "EPSG3857",
            "startName": startPosition.name, // edited --- origin: "출발지"
            "endName": endPosition.name,  // edited --- origin: "도착지"
            "searchOption": 30 //added --- 30 = 계단제외 최단경로
        },
        success: function (response) {
            var resultData = response.features;

            console.log(resultData);

            // 기존 마커 제거
            if (MarkerArr.length > 0) {
                for (var i in MarkerArr) {
                    MarkerArr[i].setMap(null);
                }
                MarkerArr = [];
            }

            // 경로(선) 그리기 초기화            
            if (linedrawArr.length > 0) {
                for (var i in linedrawArr) {
                    linedrawArr[i].setMap(null);
                }
                linedrawArr = [];
            }

            //경로 joint array 초기화
            if (gps_waypoint_array.length > 0) {
                gps_waypoint_array = [];
                turnType_array = [];
            }

            // GPS 값 검색 결과 초기화
            //document.getElementById("dots").innerText = "";
            //console.clear();

            var drawInfoArr = [];
            var turnType = -1;

            for (var i in resultData) {
                var geometry = resultData[i].geometry;
                var properties = resultData[i].properties;
                var polyline_;

                if (geometry.type == "LineString") {  // 경로의 line
                    let count = 0;
                    //distance_array.push(properties.distance);

                    console.log("linestring length >>> ", geometry.coordinates.length);

                    // Drawing polylines
                    for (var j in geometry.coordinates) {
                        console.log("linestring index:",properties.lineIndex);
                        console.log("count >>>", count);

                        var latlng = new Tmapv2.Point(geometry.coordinates[j][0], geometry.coordinates[j][1]);
                        var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlng);
                        var convertChange = new Tmapv2.LatLng(convertPoint._lat, convertPoint._lng);

                        //linstring 값도 점으로 뽑아보자.
                        var markerImg = "";
                        var pType = "";
                        var size;

                        routeBounds.extend(convertChange);
                        drawInfoArr.push(convertChange);

                        if (count == 0)
                            distance_array.push(properties.distance);

                        if (count != 0 && count != geometry.coordinates.length - 1) {

                            //linstring 값도 점으로 뽑아보자.
                            gps_waypoint_array.push(convertPoint);
                            distance_array.push(properties.distance);

                            turnType = 0; //LineString에서는 turnType이 반환이 안됨.
                            turnType_array.push(turnType);

                            //linstring 값도 점으로 뽑아보자.
                            markerImg = "http://topopen.tmap.co.kr/imgs/point.png";
                            pType = "P";
                            size = new Tmapv2.Size(8, 8);

                            var routeInfoObj = {
                                markerImage: markerImg,
                                lng: convertPoint._lng,
                                lat: convertPoint._lat,
                                pointType: pType
                            };

                            // Add marker for midpoints
                            marker_p = new Tmapv2.Marker({
                                position: new Tmapv2.LatLng(routeInfoObj.lat, routeInfoObj.lng),
                                icon: routeInfoObj.markerImage,
                                iconSize: size,
                                map: map
                            });
                            MarkerArr.push(marker_p);
                        }
                        count++;
                    }
                } else if (geometry.type == "Point") {  // 경로의 관절 (point)
                    if (properties.pointType === "SP" || properties.pointType === "EP") continue;

                    var markerImg = "";
                    var pType = "";
                    var size;
                    
                    /*if (properties.pointType == "SP") { //출발지 마커
                        markerImg = "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_s.png";
                        pType = "S";
                        size = new Tmapv2.Size(24, 38);
                    } else if (properties.pointType == "EP") { //도착지 마커
                        markerImg = "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_e.png";
                        pType = "E";
                        size = new Tmapv2.Size(24, 38);
                    }*/
                    //if (properties.pointType != "SP" && properties.pointType != "EP") { //각 포인트 마커
                    markerImg = "https://cdn-icons-png.flaticon.com/512/541/541415.png";
                    pType = "P";
                    size = new Tmapv2.Size(16, 16);
                    //}

                    // 경로들의 결과값들을 포인트 객체로 변환 
                    var latlon = new Tmapv2.Point(
                        geometry.coordinates[0],
                        geometry.coordinates[1]);

                    // 포인트 객체를 받아 좌표값으로 다시 변환
                    var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(
                        latlon);

                    var routeInfoObj = {
                        markerImage: markerImg,
                        lng: convertPoint._lng,
                        lat: convertPoint._lat,
                        pointType: pType
                    };

                    // Marker 추가
                    marker_p = new Tmapv2.Marker(
                        {
                            position: new Tmapv2.LatLng(
                                routeInfoObj.lat,
                                routeInfoObj.lng),
                            icon: routeInfoObj.markerImage,
                            iconSize: size,
                            map: map
                        });
                    MarkerArr.push(marker_p);

                    // Drawing points (start, end, mid-points)

                    //var latlon = new Tmapv2.Point(geometry.coordinates[0], geometry.coordinates[1]);
                    //var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlon);
                    gps_waypoint_array.push(convertPoint);
                    turnType_array.push(properties.turnType);

                    /*if (properties.pointType == "S") { // Start point marker
                    } else if (properties.pointType == "E") { // End point marker
                    } else { // Mid-point marker
                    }*/
                }
            }
            distance_array.push(0);

            map.panToBounds(routeBounds);
            map.setCenter(routeBounds.getCenter());

            for (var i = 0; i < gps_waypoint_array.length; i++) {
                waypoint_push(gps_waypoint_array[i]._lat, gps_waypoint_array[i]._lng, turnType_array[i], distance_array[i]);
                console.log("\n[" + i + "]\n");
                console.log("(" + gps_waypoint_array[i]._lat + ", " + gps_waypoint_array[i]._lng + ")\n");
                console.log("turnType: " + turnType_array[i] + "\n");
                console.log("distance: " + distance_array[i] + "\n");
            }
            publish();
            waypoints = [];
            // Draw polyline for the route
            drawLine(drawInfoArr);

        },
        error: function (request, status, error) {
            console.log("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
        }
    });
}




function addComma(num) {
    var regexp = /\B(?=(\d{3})+(?!\d))/g;
    return num.toString().replace(regexp, ',');
}




function drawLine(arrPoint) {
    var polyline_;

    polyline_ = new Tmapv2.Polyline({
        path: arrPoint,
        strokeColor:"#DD0000",
        strokeWeight: 6,
        map: map
    });
    linedrawArr.push(polyline_);
}
