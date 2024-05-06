Number.prototype.mod = function (n) { return ((this % n) + n) % n; };
function addvector(...v){
	let sum = v[0]
    for (i=1;i<v.length;i++) {
    	sum = sum.map((e,j) => e + v[i][j]);
    }
    return sum
}
var canvas = document.getElementById("display");
canvas.style.backgroundColor = "#000";
var ctx = canvas.getContext("2d");
let [width, height] = [canvas.width, canvas.height];

var config = {
    pos: {
        x: width / 2,
        y: 1 * height / 2,
    },
    vel: {
        x: 0,
        y: 0
    },
    angle: {
        theta: 0,
        dtheta: 0
    },
    mass: 0.01,
    length: 50,
    thrust: {
        l: 0,
        r: 0
    }
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    let rotate = (x, y, ox, oy) => [x + ox * Math.cos(config.angle.theta) - oy * Math.sin(config.angle.theta), y + ox * Math.sin(config.angle.theta) + oy * Math.cos(config.angle.theta)];
    ctx.beginPath();
    ctx.strokeStyle = "#f00";
    let targety = height-document.getElementsByName("targety")[0].value;
    ctx.moveTo(0, targety);
    ctx.lineTo(width, targety);
    ctx.stroke();
    ctx.beginPath();
    let targetx = document.getElementsByName("targetx")[0].value;
    ctx.moveTo(targetx, 0);
    ctx.lineTo(targetx, height);
    ctx.stroke();

    //body
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(...rotate(config.pos.x, config.pos.y, 5, 0));
    ctx.lineTo(...rotate(config.pos.x, config.pos.y, 0, -10));
    ctx.lineTo(...rotate(config.pos.x, config.pos.y, -5, 0));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(...rotate(config.pos.x, config.pos.y, config.length, 0));
    ctx.lineTo(...rotate(config.pos.x, config.pos.y, -config.length, 0));
    ctx.stroke();

    let tf = 10
    //left rotor
    let lrf = Math.sqrt((config.thrust.l * tf) ** 2 + config.length ** 2);
    let ltf = -Math.atan2(config.thrust.l * tf, config.length);
    ctx.strokeStyle = "#0f0";
    ctx.beginPath();
    ctx.moveTo(config.pos.x - config.length * Math.cos(config.angle.theta), config.pos.y - config.length * Math.sin(config.angle.theta));
    ctx.lineTo(config.pos.x - lrf * Math.cos(ltf + config.angle.theta), config.pos.y - lrf * Math.sin(ltf + config.angle.theta));
    ctx.stroke();
    //right rotor
    let rrf = Math.sqrt((config.thrust.r * tf) ** 2 + config.length ** 2);
    let rtf = +Math.atan2(config.thrust.r * tf, config.length);
    ctx.strokeStyle = "#0f0";
    ctx.beginPath();
    ctx.moveTo(config.pos.x + config.length * Math.cos(config.angle.theta), config.pos.y + config.length * Math.sin(config.angle.theta));
    ctx.lineTo(config.pos.x + rrf * Math.cos(rtf + config.angle.theta), config.pos.y + rrf * Math.sin(rtf + config.angle.theta));
    ctx.stroke();

}

function update(dt) {
    if (config.pos.y >= height) {
        config.pos.y -= 0.1;
        config.vel.y = -Math.abs(config.vel.y * 0.3);
        // config.angle.dtheta = -config.angle.dtheta * 0.5;
    }
    if (config.pos.x <= 0) config.vel.x = Math.abs(config.vel.x * 0.5);
    if (config.pos.x >= width) config.vel.x = -Math.abs(config.vel.x);

    
    let targety = height-document.getElementsByName("targety")[0].value;
    let targetx = document.getElementsByName("targetx")[0].value;
    let targettheta = Math.min(1,Math.max(-1,(targetx-config.pos.x)*0.003-0.01*config.vel.x))
    function T_angle(a) {
        let delta = Math.min(a-targettheta, 2 * Math.PI - a+targettheta)*Math.sign(a- Math.PI);
        return [
            delta*1.1,
            -delta*1.1
        ]
    }
    function T_dangle(a) {
        return [
            -a*1.5,
            a*1.5
        ]
    }
    function T_y(y) {
        return [0.01*(y-targety)+(98/2*config.mass),0.01*(y-targety)+(98/2*config.mass)];//set Fnet=>0
    }
    function T_dy(dy) {
        return [0.01*dy,0.01*dy];
    }
    let assist = document.getElementsByName("assist")[0].checked;
    auto = addvector(
        T_angle(config.angle.theta),
        T_dangle(config.angle.dtheta),
        T_y(config.pos.y),
        T_dy(config.vel.y)
    )
    
    config.thrust = {
        l: auto[0]*assist,
        r: auto[1]*assist
    }
    config.thrust.l = Math.min(10, Math.max(0, config.thrust.l))+(keys.a ? 2 : 0)+(keys.s ? 2 : 0);
    config.thrust.r = Math.min(10, Math.max(0, config.thrust.r))+(keys.d ? 2 : 0)+(keys.s ? 2 : 0);

    let F = [
        (config.thrust.l + config.thrust.r) * Math.sin(config.angle.theta) - config.mass * 0.1 * config.vel.x,
        config.mass * 98 - config.mass * 0.1 * config.vel.y - (config.thrust.l + config.thrust.r) * Math.cos(config.angle.theta),
        config.length * (config.thrust.l - config.thrust.r)
    ]

    let step = {
        pos: {
            x: config.pos.x + dt * config.vel.x + 0.5 * dt * dt * F[0] / config.mass,
            y: config.pos.y + dt * config.vel.y + 0.5 * dt * dt * F[1] / config.mass
        },
        vel: {
            x: config.vel.x + dt * F[0] / config.mass,
            y: config.vel.y + dt * F[1] / config.mass
        },
        angle: {
            theta: (config.angle.theta + dt * config.angle.dtheta).mod(2 * Math.PI),
            dtheta: config.angle.dtheta + dt * F[2] / (config.mass * config.length ** 2)
        },
    }
    config.vel = step.vel;
    config.angle = step.angle;
    config.pos = step.pos;
}

var keys = {
    a: false,
    d: false,
    s: false,
};
window.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) {
        return;
    }
    let a = true;
    //s:
    if (e.keyCode == 83) keys.s = a;
    if (e.keyCode == 65) keys.a = a;
    if (e.keyCode == 68) keys.d = a;
});
window.addEventListener("keyup", (e) => {
    if (e.isComposing || e.keyCode === 229) {
        return;
    }
    let a = false;
    if (e.keyCode == 83) keys.s = a;
    if (e.keyCode == 65) keys.a = a;
    if (e.keyCode == 68) keys.d = a;
});

let fps = 60;
setInterval(() => {
    update(1 / fps);
    draw();
}, 1000 / fps);

