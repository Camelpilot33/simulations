import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import * as a from 'https://unpkg.com/three@0.157.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
let OrbitControls = a.OrbitControls;

var camera, scene, renderer, controls, car3d;
var keys = {
    w: false,
    a: false,
    s: false,
    d: false,
}
var car = {
    pos: new THREE.Vector2(0, 0),
    theta: 0,
    vel: new THREE.Vector2(0, 0),
    omega: 0,
    phi: 0,
    build: {
        I_z: 140,
        mass: 1000,
        wheels: {
            lf: 0.9,
            lr: 1.5,
            ydist2: 0.63,
            h: 0.4,
            geom: [0.4, 0.4, 0.3, 32]
        },
        body: [3.5, 1.5, 0.7],
        F_max: 1000,
        steer_max: Math.PI / 4,
    },
    debug: {
        prevpos: new THREE.Vector2(0, 0),
    }
}

function three_init() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    //camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight);
    camera.position.set(-20, 0, 14);
    camera.up.set(0, 0, 1);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 2;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
    }

    //scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    //grid
    const gridHelper = new THREE.GridHelper(1000, 30, 0, 0xaaaaaa);
    gridHelper.rotation.x = Math.PI / 2;

    // car
    let bodymat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    let wheelmat = new THREE.MeshPhongMaterial({ color: 0x000000 });

    let cubegeometry = new THREE.BoxGeometry(...car.build.body);
    let bodymesh = new THREE.Mesh(cubegeometry, bodymat);
    let wheels = new THREE.Group();
    let wheelgeometry = new THREE.CylinderGeometry(...car.build.wheels.geom);
    let wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    bodymesh.position.set((car.build.wheels.lf - car.build.wheels.lr) / 2, 0, 0.5);

    wheelmesh.position.set(car.build.wheels.lf, car.build.wheels.ydist2, car.build.wheels.h);
    wheels.add(wheelmesh);
    wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(-car.build.wheels.lr, car.build.wheels.ydist2, car.build.wheels.h);
    wheels.add(wheelmesh);
    wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(car.build.wheels.lf, -car.build.wheels.ydist2, car.build.wheels.h);
    wheels.add(wheelmesh);
    wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(-car.build.wheels.lr, -car.build.wheels.ydist2, car.build.wheels.h);
    wheels.add(wheelmesh);

    car3d = new THREE.Object3D();
    car3d.add(bodymesh);
    car3d.add(wheels);
    car3d.add(camera)

    // lights
    var light = new THREE.AmbientLight(0xffffff, 0.5);
    var directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, 0, 1);

    scene.add(gridHelper);
    scene.add(light);
    scene.add(directionalLight);
    scene.add(car3d);

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
}


function update(dt) {
    //controls
    let F_u = keys.w ? car.build.F_max : 0 - (keys.s ? car.build.F_max : 0);
    car.phi = Math.max(-car.build.steer_max, Math.min(car.build.steer_max, car.phi + (keys.a - keys.d) * 0.1));

    //quick
    let m = car.build.mass;
    let I_z = car.build.I_z;
    let l_f = car.build.wheels.lf;
    let l_r = car.build.wheels.lr;
    let phi = car.phi;
    let theta = car.theta;
    let omega = car.omega;
    let dx = car.vel.x;
    let dy = car.vel.y;
    let h = car.build.wheels.h;
    let BtoE = (bx, by, a) => new THREE.Vector2(bx * Math.cos(a) - by * Math.sin(a), bx * Math.sin(a) + by * Math.cos(a)),EtoB = (ex, ey, a) => new THREE.Vector2(ex * Math.cos(a) + ey * Math.sin(a), -ex * Math.sin(a) + ey * Math.cos(a));
    let cos = Math.cos;
    let sin = Math.sin;
    let v = EtoB(dx, dy, theta)

    //Friction
    //Paper 1: https://dcsl.gatech.edu/papers/acc13b.pdf
    // let s_fx = 0
    // let s_rx = 0
    // let s_fy = ((v.y+l_f*omega)*cos(phi)-v.x*sin(phi))/(v.x*cos(phi)+(v.y+l_f*omega)*sin(phi)+1e-20)
    // let s_ry = (v.y-l_r*omega)/(v.x+1e-20)
    // let s_f = Math.sqrt(s_fy**2+s_fx**2)+1e-20
    // let s_r = Math.sqrt(s_ry**2+s_rx**2)+1e-20
    // let μ_f = 1*sin(1.90*Math.atan(10*s_f))
    // let μ_r = 1*sin(1.90*Math.atan(10*s_r))
    // let μ_fx = -(s_fx/s_f)*μ_f
    // let μ_fy = -(s_fy/s_f)*μ_f
    // let μ_rx = -(s_rx/s_r)*μ_r
    // let μ_ry = -(s_ry/s_r)*μ_r 
    // let F_fz = m*9.81*(l_r-μ_rx*h)/(l_f+l_r+h*(μ_fx*cos(phi)+μ_fy*sin(phi)-μ_rx))
    // let F_rz = m*9.81-F_fz
    // let F_fx = μ_fx*F_fz
    // let F_fy = μ_fy*F_fz
    // let F_rx = μ_rx*F_rz
    // let F_ry = μ_ry*F_rz

    //Paper 2: https://www.cs.cmu.edu/afs/cs/Web/People/motionplanning/reading/PlanningforDynamicVeh-1.pdf
    let A = 0
    let B = 0
    let F_fx = 0
    let F_rx = 0
    let F_fy = -A*((v.y+l_f*1)/(v.x+1e-20)-phi)
    let F_ry = -B*(v.y-l_r*1)/(v.x+1e-20)

    let dv_x = (F_u*cos(phi)+   F_fx * cos(phi) - F_fy * sin(phi) + F_rx) / m + v.y * omega;
    let dv_y = (F_u*sin(phi)+   F_fx * sin(phi) + F_fy * cos(phi) + F_ry) / m - v.x * omega;
    let domega = (l_f*(F_fx*sin(phi)+F_fy*cos(phi))-l_r*F_ry) / I_z;
    window.debuga = [v.x,v.y,[dv_x,dv_y,domega]]


    let newstate = {
        pos: car.pos.clone().add(car.vel.clone().multiplyScalar(dt)),
        theta: car.theta + car.omega * dt,
        vel: car.vel.clone().add(BtoE(dv_x, dv_y, car.theta).multiplyScalar(dt)),
        omega: car.omega+domega*dt,
        phi: car.phi,
    }

    car.pos = newstate.pos;
    car.theta = newstate.theta;
    car.vel = newstate.vel;
    car.omega = newstate.omega;
    car.phi = newstate.phi;



    //update car
    car3d.rotation.z = car.theta;
    car3d.position.set(car.pos.x, car.pos.y, 0);
    car3d.children[1].children[0].rotation.z = car.phi;
    car3d.children[1].children[2].rotation.z = car.phi;
}

var clock = new THREE.Clock();
var delta = 0;
function animate() {
    requestAnimationFrame(animate);
    delta = clock.getDelta();
    //update
    update(delta);
    controls.update();
    camera.lookAt(car3d.position)
    renderer.render(scene, camera);
}


//key handling
document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});
document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});


if (WebGL.isWebGLAvailable()) {
    three_init();
    animate();
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
}

window.car = car;
window.exec = (str) => { return eval(str) };
window.scene = scene;