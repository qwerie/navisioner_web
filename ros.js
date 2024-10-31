const ros = new ROSLIB.Ros();

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