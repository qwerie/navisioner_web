var map, marker_s, marker_e, marker_p;
var markerArr = [];
var startPosition = null;
var endPosition = null;
var gps_joint_array = []; // 경로 joint 배열
var resultdrawArr = []; // 경로 그리기 배열
const ros = new ROSLIB.Ros();

// ROS 연결
ros.connect('ws://192.168.0.65:9090');

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
    name: '/topic',
    messageType: 'std_msgs/String'
});

let msg = new ROSLIB.Message({
    data: ''
});

function publish(content) {
    msg.data = content   //일단 첫번째 값만 보내겠음. 추후에 수정해야함. (데이터 형식 어떻게 보내야하는지 먼저 알아봐야함.)
    topic.publish(msg)
}

function initTmap() {
    // 지도 띄우기
    map = new Tmapv2.Map("background", { //map_div
        center: new Tmapv2.LatLng(37.56520450, 126.98702028),
        width: "100%", //70%
        height: "1000px", //400px
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
            if (markerArr.length > 0) {
                for (var i in markerArr) {
                    markerArr[i].setMap(null);
                }
                markerArr = [];
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
                var lon = projectionCng._lng;

                var markerPosition = new Tmapv2.LatLng(lat, lon);

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
                markerArr.push(marker); // 마커 배열에 추가

                // 검색 결과 목록에 추가
                innerHtml += "<li data-lat='" + lat + "' data-lng='" + lon + "' data-name='" + name + "'>" +
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
                    //alert("출발지 설정: " + selectedName);
                } else {
                    endPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
                    $("#searchEnd").val(selectedName);  // 도착지 입력란에 선택된 장소 이름 입력
                    //alert("도착지 설정: " + selectedName);
                }

                //added --- 출발, 도착지의 gps도 추가하기
                gps_joint_array.push([selectedLat, selectedLng]);

                $("#searchResult").html("");

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

    // 기존 마커 제거
    if (marker_s) marker_s.setMap(null);
    if (marker_e) marker_e.setMap(null);

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

            // 경로 그리기 초기화
            if (resultdrawArr.length > 0) {
                for (var i in resultdrawArr) {
                    resultdrawArr[i].setMap(null);
                }
                resultdrawArr = [];
            }

            //경로 joint array 초기화
            if (gps_joint_array.length > 0) {
                gps_joint_array = [];
            }

            // GPS 값 검색 결과 초기화
            $("#dots").innerhtml = "";

            var drawInfoArr = [];

            for (var i in resultData) {
                var geometry = resultData[i].geometry;
                var properties = resultData[i].properties;
                var polyline_;

                if (geometry.type == "LineString") {  // 경로의 line
                    // Drawing polylines
                    for (var j in geometry.coordinates) {
                        var latlng = new Tmapv2.Point(geometry.coordinates[j][0], geometry.coordinates[j][1]);
                        var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlng);
                        var convertChange = new Tmapv2.LatLng(convertPoint._lat, convertPoint._lng);
                        drawInfoArr.push(convertChange);
                    }
                } else if (geometry.type == "Point") {  // 경로의 관절 (point)
                    // Drawing points (start, end, mid-points)
                    var markerImg = "";
                    var pType = "";
                    var size;

                    if (properties.pointType == "S") { // Start point marker
                        markerImg = "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_s.png";
                        pType = "S";
                        size = new Tmapv2.Size(24, 38);
                    } else if (properties.pointType == "E") { // End point marker
                        markerImg = "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_e.png";
                        pType = "E";
                        size = new Tmapv2.Size(24, 38);
                    } else { // Mid-point marker
                        markerImg = "http://topopen.tmap.co.kr/imgs/point.png";
                        pType = "P";
                        size = new Tmapv2.Size(8, 8);
                    }

                    // Yujin Added
                    var latlon = new Tmapv2.Point(geometry.coordinates[0], geometry.coordinates[1]);
                    var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlon);
                    gps_joint_array.push([convertPoint._lat, convertPoint._lng]);

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
                }
            }

            for (var latlng of gps_joint_array) {
                $("#dots").append(latlng + "<br>");
                publish(String(latlng));
            }
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
        strokeColor: "#DD0000",
        strokeWeight: 6,
        map: map
    });
    resultdrawArr.push(polyline_);
}
