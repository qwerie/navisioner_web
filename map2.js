window.speechSynthesis;

var map, marker_s, marker_e, marker_p;
var listMarkerArr = [];
var markerArr = [];
var startPosition = null;
var endPosition = null;
var gps_waypoint_array = []; // waypoint 저장할 배열
var turnType_array = [];  // TurnType 배열
var linedrawArr = []; // 경로 그리기 배열
let clickCount = 0; // 클릭 횟수를 추적
let audioPlayed = false; // 오디오 재생 상태를 추적하는 변수 선언
const audio_StartPoint = new Audio('./audio/02_Say_Start_Point.mp3'); // 오디오 파일 경로 설정
const audio_EndPoint = new Audio('./audio/03_Say_End_Point.mp3'); // 오디오 파일 경로 설정
let SetStart = false;
let SetEnd = false;
const ros = new ROSLIB.Ros();
let waypoints = []; //WaypointArray.msg 안에 들어갈 waypoints[]

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

function waypoint_push (x,y,turnType, distance){
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
        height: "60vh", //400px
        zoom: 17,
        zoomControl: true,
        scrollwheel: true
    });

    // 화면 클릭 이벤트 추가
    document.addEventListener("click", function () {
        clickCount++;

        if (clickCount === 3 && SetStart === false) {
            if (!audioPlayed) {
                audio_StartPoint.play()
                    .then(() => {
                        audioPlayed = true; // 오디오 재생 성공 시 상태 업데이트
                        console.log("오디오 재생 시작");
                    })
                    .catch((error) => {
                        console.error("Audio play failed:", error);
                    });
    
                // 오디오 재생이 끝난 후 실행
                audio_StartPoint.addEventListener("ended", function () {
                    console.log("오디오 재생 완료");
                    callFlaskAndSearch('start'); // 오디오 재생이 끝난 후 실행
                    clickCount = 0; // 클릭 횟수 초기화
                    audioPlayed = false; // 상태 초기화

                }, { once: true }); // 이벤트가 한 번만 실행되도록 설정
                
            } else {
                callFlaskAndSearch(); // 이미 재생된 상태라면 바로 실행
                clickCount = 0; // 클릭 횟수 초기화
                audioPlayed = false; // 상태 초기화
            }
        }
        if (clickCount === 3 && SetStart === true) {
            if (!audioPlayed) {
                audio_EndPoint.play()
                    .then(() => {
                        audioPlayed = true; // 오디오 재생 성공 시 상태 업데이트
                        console.log("오디오 재생 시작");
                    })
                    .catch((error) => {
                        console.error("Audio play failed:", error);
                    });
    
                // 오디오 재생이 끝난 후 실행
                audio_EndPoint.addEventListener("ended", function () {
                    console.log("오디오 재생 완료");
                    callFlaskAndSearch('end'); // 오디오 재생이 끝난 후 실행
                    clickCount = 0; // 클릭 횟수 초기화
                    audioPlayed = false; // 상태 초기화

                }, { once: true }); // 이벤트가 한 번만 실행되도록 설정
                
            } 
        }
        if (SetStart === true && SetEnd === true) {
            console.log("길찾기 시작");
            console.log(startPosition);
            console.log(endPosition);
            findRoute(startPosition, endPosition);
            }
    });

    // 출발지 검색 엔터로 동작
    // $("#searchStart").keypress(function (e) {
    //     if (e.keyCode === 13) {
    //         searchLocation('start')
    //     }
    // });

    // // 도착지 검색 엔터로 동작
    // $("#searchEnd").keypress(function (e) {
    //     if (e.keyCode === 13) {
    //         searchLocation('end')
    //     }
    // });

    // // 출발지 검색 버튼 클릭
    // $("#btn_select_start").click(function () {
    //     searchLocation('start')
    // });

    // // 도착지 검색 버튼 클릭
    // $("#btn_select_end").click(function () {
    //     searchLocation('end')
    // });

    // 길찾기 버튼 클릭
    /*$("#btn_find_route").click(function () {
        if (startPosition && endPosition) {
            findRoute(startPosition, endPosition);
        } else {
            alert("출발지와 도착지를 모두 선택해주세요.");
        }
    });*/

    // Flask API 호출 버튼 클릭 이벤트 추가
    // $("#btn_call_flask").click(function () {
    //     callFlaskAPI();
    // });


}
// Flask API 호출 및 검색 실행 함수
async function callFlaskAndSearch(type) {
    try {
        // Flask API 호출
        const response = await fetch('/whisper', {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error('Flask API 호출에 실패했습니다.');
        }

        const data = await response.json();
        const flaskResult = data.result;

        if (flaskResult) {
            // Flask에서 반환된 값을 검색어로 설정
            if (type === 'start') {
                $("#searchStart").val(flaskResult);
                searchLocation(type); // 출발지 검색 실행
            }
            else {
                $("#searchEnd").val(flaskResult);
                searchLocation(type); // 출발지 검색 실행
            }
        } else {
            alert('Flask API에서 결과를 반환하지 않았습니다.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Flask API 호출 실패');
    }
}

// Flask API 호출 및 검색 실행 함수
async function STT() {
    try {
        // Flask API 호출
        const response = await fetch('/whisper', {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error('Flask API 호출에 실패했습니다.');
        }

        const data = await response.json();
        const flaskResult = data.result;

        if (flaskResult) {
            return flaskResult;
        } else {
            alert('Flask API에서 결과를 반환하지 않았습니다.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Flask API 호출 실패');
    }
}

async function searchLocation(type) {
    var searchKeyword;
    if (type === 'start') {
        searchKeyword = $('#searchStart').val();
    } else {
        searchKeyword = $('#searchEnd').val();
    }

    var text = searchKeyword.trim().toLowerCase();
    console.log(text);
    
    if (text.includes("대양 ai")||text.includes("대양ai")||text.includes("대양a")) {
        let innerHtml = "<li data-lat='37.550421646492495' data-lng='127.07584368629597' data-name='세종대학교 대양AI센터'>" +
        "<img src='https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_b_m_" + 0 + ".png' style='vertical-align:middle;'/>" +
        "<span>세종대학교 대양AI센터</span>" +
        "</li>";

        // "<button class='btn_select' data-type='" + type + "'>선택</button>" +

        console.log(innerHtml);
        // 검색 결과 목록에 추가
        
        $("#searchResult").html(innerHtml); // 검색 결과를 HTML에 삽입
        
        // 출발지 또는 도착지 선택 이벤트 처리
        var selectedLat = $(this).parent().data('lat');
        var selectedLng = $(this).parent().data('lng');
        var selectedName = $(this).parent().data('name');
        var locationType = $(this).data('type');

        if (locationType === 'start') {
            startPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
            SetStart = true;
            processPoi([{id:0, name: "세종대학교 대양AI센터"}], 0);
            $("#searchStart").val(selectedName);  // 출발지 입력란에 선택된 장소 이름 입력
        } else {
            endPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
            SetEnd = true;
            processPoi([{id:0, name: "세종대학교 대양AI센터"}], 0);
            $("#searchEnd").val(selectedName);  // 도착지 입력란에 선택된 장소 이름 입력
        }

        $("#searchResult").html("");
        
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
            // JSON 데이터를 순회하며 특정 조건을 만족하면 반복 종료

            processPoi(resultpoisData, 0); // 첫 번째 POI 처리 시작

            // **검색 결과를 JSON 형식으로 저장**
            const jsonResult = JSON.stringify(resultpoisData); // JSON 문자열로 변환
            console.log("저장된 JSON 데이터:", jsonResult); // 확인용 콘솔 출력

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
                listMarkerArr.push(marker); // 마커 배열에 추가

                // 검색 결과 목록에 추가
                innerHtml += "<li data-lat='" + lat + "' data-lng='" + lon + "' data-name='" + name + "'>" +
                    "<img src='https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_b_m_" + k + ".png' style='vertical-align:middle;'/>" +
                    "<span>" + name + "</span>" +
                    "</li>";

                // "<button class='btn_select' data-type='" + type + "'>선택</button>" +

                positionBounds.extend(markerPosition); // LatLngBounds 객체 확장
            }

            $("#searchResult").html(innerHtml); // 검색 결과를 HTML에 삽입
            map.panToBounds(positionBounds); // 확장된 bounds의 중심으로 이동시키기

        },
        error: function (request, status, error) {
            console.log("code:" + request.status + "\n" + "message:" + request.responseText + "\n" + "error:" + error);
        }
    });

    function processPoi(resultpoisData, index) {
        if (index >= resultpoisData.length) return; // 모든 결과를 처리했으면 종료
    
        const poi = resultpoisData[index];
        console.log(`ID: ${poi.id}, Name: ${poi.name}`);
    
        // 음성 재생
        const utter = new SpeechSynthesisUtterance(poi.name + '이신가요?');
        utter.rate = 0.7; // 음성 속도
        utter.pitch = 1; // 음높이
        utter.volume = 1; // 음량
    
        // 음성 재생 완료 후 STT 실행
        utter.onend = async function () {
            console.log("음성 재생 완료. STT 시작...");
            const answer = await STT();
    
            console.log("answer:", answer);
            console.log("answer 자료형:", typeof answer); // 자료형 확인
    
            await new Promise(resolve => setTimeout(resolve, 1000));
    
            const trimmedAnswer = answer.trim(); // 공백 제거 및 소문자 변환
            console.log("trimmedAnswer:", trimmedAnswer);
    
            if (type === 'start') {
                if (SetStart==true) return;
            } else {
                if (SetEnd ==true) return;
            }
    
            // 특정 조건 (예: "맞아요", "네", "예")을 만족하면 반복 종료
            if (trimmedAnswer === "맞아요" ||trimmedAnswer === "맞아요." ||  trimmedAnswer === "네" || trimmedAnswer === "예") {
                console.log("조건을 만족했습니다. 반복을 종료합니다.");
        
                var frontLat = Number(poi.frontLat);
                var frontLon = Number(poi.frontLon);
                var name = poi.name;
    
                var pointCng = new Tmapv2.Point(frontLon, frontLat);
                var projectionCng = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(pointCng);
    
                var selectedLat = projectionCng._lat;
                var selectedLng = projectionCng._lng;
                var selectedName = name;
    
    
                // 출발지 또는 도착지 설정
                if (type === 'start') {
                    startPosition = { lat: selectedLat, lng: selectedLng, name: selectedName };
                    $("#searchStart").val(poi.name); // 출발지 입력란에 선택된 장소 이름 입력
                    SetStart = true; // Start 지점 Set 된 것을 알려줌

                    if (marker_s){ //기존에 마크가 찍혀있었으면 지워주기
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
                    $("#searchEnd").val(poi.name); // 도착지 입력란에 선택된 장소 이름 입력
                    SetEnd = true; // end 지점 Set 된 것을 알려줌
                    
                    if (marker_e){ //기존에 마크가 찍혀있었으면 지워주기
                        marker_e.setMap(null);
                    }

                    marker_e = new Tmapv2.Marker({
                        position: new Tmapv2.LatLng(endPosition.lat, endPosition.lng),
                        icon: "https://tmapapi.tmapmobility.com/upload/tmap/marker/pin_r_m_e.png",
                        iconSize: new Tmapv2.Size(24, 38),
                        map: map
                    });
                }
    
                $("#searchResult").html(""); // 검색 결과 초기화
                // 기존 마커 제거
                if (listMarkerArr.length > 0) {
                    for (var i in listMarkerArr) {
                        listMarkerArr[i].setMap(null);
                    }
                    listMarkerArr = [];
                }

                return; // 반복 종료
            } else {
                //index++; // 다음 결과로 이동
                processPoi(resultpoisData, index+1); // 다음 POI 처리
            }
        };
    
        // 음성 재생
        window.speechSynthesis.speak(utter);
    }
}


function findRoute(startPosition, endPosition) {
    var headers = {};
    headers["appKey"] = "nQev4Gnamg53zSwXItuHK4HnbaFL5Ho7740Jx8hX";

    var routeBounds = new Tmapv2.LatLngBounds();

    /*// 기존 마커 제거
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
    });*/

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
            console.log(response);
            console.log("answer 자료형:", typeof startPosition.lng); // 자료형 확인
            console.log("answer 자료형:", typeof startPosition.lat); // 자료형 확인
            console.log("answer 자료형:", typeof startPosition.name); // 자료형 확인

            var resultData = response.features;

            // 기존 마커 제거
            if (MarkerArr.length > 0) {
                for (var i in MarkerArr) {
                    MarkerArr[i].setMap(null);
                }
                MarkerArr = [];
            }

            // 경로 그리기 초기화
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
                    
                    // Drawing polylines
                    for (var j in geometry.coordinates) {
                        var latlng = new Tmapv2.Point(geometry.coordinates[j][0], geometry.coordinates[j][1]);
                        var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlng);
                        var convertChange = new Tmapv2.LatLng(convertPoint._lat, convertPoint._lng);
                        var markerImg = "";
                        var pType = "";
                        var size;

                        routeBounds.extend(convertChange);
                        drawInfoArr.push(convertChange);
                        //gps_waypoint_array.push(convertPoint);
                        
                        /*
                        if(turnType == 0){ //Middle point or End point일 경우
                            turnType_array.push(turnType);
                            gps_waypoint_array.push(convertPoint);
                        }

                        turnType = 0; //LineString에서는 turnType이 반환이 안됨.

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
                        });*/

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
                    // Drawing points (start, end, mid-points)
                    /*turnType_array.pop();
                    turnType = properties.turnType;
                    turnType_array.push(turnType);

                    gps_waypoint_array.pop();
                    var latlon = new Tmapv2.Point(geometry.coordinates[0], geometry.coordinates[1]);
                    var convertPoint = new Tmapv2.Projection.convertEPSG3857ToWGS84GEO(latlon);
                    gps_waypoint_array.push(convertPoint);
                    */
                    if (properties.pointType === "SP" || properties.pointType === "EP") continue;

                    var markerImg = "";
                    var pType = "";
                    var size;

                    markerImg = "https://cdn-icons-png.flaticon.com/512/541/541415.png";
                    pType = "P";
                    size = new Tmapv2.Size(16, 16);
                    

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
                    /*if (properties.pointType == "S") { // Start point marker
                    } else if (properties.pointType == "E") { // End point marker
                    } else { // Mid-point marker
                    }*/
                    gps_waypoint_array.push(convertPoint);
                    turnType_array.push(properties.turnType);                    
                }
            }
            distance_array.push(0);

            map.panToBounds(routeBounds);
            map.setCenter(routeBounds.getCenter());
            
            for (var i=0 ; i < gps_waypoint_array.length ; i++) {
                waypoint_push(gps_waypoint_array[i]._lat, gps_waypoint_array[i]._lng, turnType_array[i])
                console.log("\n["+i+"]\n");
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
        strokeColor: "#DD0000",
        strokeWeight: 6,
        map: map
    });
    linedrawArr.push(polyline_);
}

