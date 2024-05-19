import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import * as a from 'https://unpkg.com/three@0.157.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
let OrbitControls = a.OrbitControls;

var camera, scene, renderer, controls, bodymesh, car;
var keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    p: false
}
var carmodel = {
    pos: new THREE.Vector2(0, 0),
    momentum: new THREE.Vector2(0, 0),
    rot: 0,
    speed:0,
    phi: 0,
    momentum: new THREE.Vector2(0, 0),
    build: {
        wheels: {
            xdist:2.4,
            ydist2:0.63,
            h:0.4
        }
    }
    // inertia: new THREE.Matrix3(),
}
var debug = {
    prevpos:new THREE.Vector2(0,0),
}

function three_init() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    //camera & scene
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight);
    camera.position.set(-20, 0, 14);
    // camera.lookAt(0, 0, 0);
    camera.up.set(0, 0, 1);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    controls = new OrbitControls(camera, renderer.domElement);

    // lines
    for (let iter = 0; iter < 3; iter++) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(iter == 2, iter == 1, iter == 0), new THREE.Vector3(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xff * Math.pow(256, iter) })));
    const gridHelper = new THREE.GridHelper( 1000, 10 );
    gridHelper.rotation.x = Math.PI / 2;
    scene.add( gridHelper );

    // car
    let bodymat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    var cubegeometry = new THREE.BoxGeometry(3.5, 1.5, 0.7);
    bodymesh = new THREE.Mesh(cubegeometry, bodymat);
    bodymesh.position.set(carmodel.build.wheels.xdist/2, 0, 0.5);
    let wheels = new THREE.Group();
    let wheelmat = new THREE.MeshPhongMaterial({ color: 0x000000 });
    let wheelgeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
    let wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(carmodel.build.wheels.xdist, carmodel.build.wheels.ydist2, carmodel.build.wheels.h);
    wheels.add(wheelmesh);
    wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(0, carmodel.build.wheels.ydist2, carmodel.build.wheels.h);
    wheels.add(wheelmesh);
    wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(carmodel.build.wheels.xdist, -carmodel.build.wheels.ydist2, carmodel.build.wheels.h);
    wheels.add(wheelmesh);
    wheelmesh = new THREE.Mesh(wheelgeometry, wheelmat);
    wheelmesh.position.set(0, -carmodel.build.wheels.ydist2, carmodel.build.wheels.h);
    wheels.add(wheelmesh);
    // scene.add(wheels);
    //attach car mesh to car object
    car = new THREE.Object3D();
    car.add(bodymesh);
    car.add(wheels);
    scene.add(car);
    car.add(camera)

    // lights
    var light = new THREE.AmbientLight(0xffffff, 0.5);
    var directionalLight = new THREE.DirectionalLight(0xffffff);
    scene.add(light);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
    // //input
    // keys = {};
    // document.addEventListener("keydown", (event) => {
    //     keys[event.key] = true;
    // });
    // document.addEventListener("keyup", (event) => {
    //     keys[event.key] = false;
    // });
}
function update(dt) {
    let s = carmodel.pos;
    let f = new THREE.Vector2(Math.cos(carmodel.rot), Math.sin(carmodel.rot));
    let ds = carmodel.speed*dt//*(0.1+carmodel.momentum.clone().normalize().dot(f));
    let l = carmodel.build.wheels.xdist;
    let N,X,R;


    //controls
    carmodel.phi += ((keys.a ? 1:0) + (keys.d ? -1 : 0))*0.05
        -(carmodel.phi!=0?carmodel.phi/Math.abs(carmodel.phi)*0.01:0);
    carmodel.phi = Math.max(-0.8, Math.min(0.8, carmodel.phi));

    carmodel.speed = Math.max(0,carmodel.speed+
        ((keys.w ? 1 : 0) - 3*(keys.s ? 1 : 0)-0.2*(keys.p ? 1 : 0))*0.1
    )*0.998*(0.95+0.05*carmodel.momentum.clone().normalize().dot(f));


    // (((keys.w ? 1 : 0) + (keys.s ? -1 : 0)))/(Math.abs(carmodel.speed)<1?1:Math.abs(carmodel.speed))*0.1;



    if (Math.abs(carmodel.phi)>10e-5) {
        R = 2*l/Math.tan(carmodel.phi)
        X = s.clone().add(new THREE.Vector2(-f.y, f.x).multiplyScalar(R))
        N = carmodel.phi>0
        ?X.clone().add(new THREE.Vector2(Math.cos(ds/R+Math.atan2(X.y-s.y,X.x-s.x)+Math.PI), Math.sin(ds/R+Math.atan2(X.y-s.y,X.x-s.x)+Math.PI)).multiplyScalar(R))
        :X.clone().sub(new THREE.Vector2(Math.cos(ds/R+Math.atan2(X.y-s.y,X.x-s.x)+Math.PI), Math.sin(ds/R+Math.atan2(X.y-s.y,X.x-s.x)+Math.PI)).multiplyScalar(R))
    } else {
        R = 1e9
        X = s.clone().add(new THREE.Vector2(-f.y, f.x).multiplyScalar(1000))
        N = s.clone().add(f.normalize().multiplyScalar(ds))
    }


    carmodel.momentum.add(new THREE.Vector2(Math.cos(carmodel.rot), Math.sin(carmodel.rot)).multiplyScalar(carmodel.speed*dt))
    carmodel.momentum.multiplyScalar(0.95)
    carmodel.pos.set(N.x, N.y, 0)
        // .add(new THREE.Vector2(-f.y, f.x).multiplyScalar(-0.5*carmodel.phi*dt*(carmodel.speed)))
        // .add(
        //     carmodel.momentum.clone().multiplyScalar(0.2*carmodel.speed/10)
        //         //.sub(f.multiplyScalar(0.1*carmodel.momentum.clone().dot(f)).multiplyScalar(0.2*carmodel.speed/4))
        // );

    carmodel.rot +=ds/R+dt*carmodel.momentum.clone().dot(new THREE.Vector2(f.y, -f.x).normalize())*0.05;
    
    //debug
    for (let i of scene.children) if (i instanceof THREE.Line&& i.material.color.r+i.material.color.g+i.material.color.b==2) scene.remove(i)
    
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x,s.y,1), new THREE.Vector3(debug.prevpos.x,debug.prevpos.y,1)]), new THREE.LineBasicMaterial({ color: 1})));
    
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x,s.y,1), new THREE.Vector3
    (s.x+carmodel.momentum.x,s.y+carmodel.momentum.y,1)]), new THREE.LineBasicMaterial({ color: 0xff00ff})));
    
    // scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x,s.y,1), new THREE.Vector3(X.x,X.y,1)]), new THREE.LineBasicMaterial({ color: 0xff00ff})));

    debug.prevpos = s.clone();
    car.position.set(carmodel.pos.x, carmodel.pos.y, 0);
    car.rotation.z = carmodel.rot;
    car.children[1].children[0].rotation.z = carmodel.phi;
    car.children[1].children[2].rotation.z = carmodel.phi;
}

var clock = new THREE.Clock();
var speed = 1;
var delta = 0;
function animate() {
    requestAnimationFrame(animate);
    delta = clock.getDelta();
    //update
    controls.update();
    camera.lookAt(car.position)
    renderer.render(scene, camera);
    update(delta);
}


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
window.carmodel = carmodel;
window.exec=(str) => {return eval(str)};
window.scene = scene;