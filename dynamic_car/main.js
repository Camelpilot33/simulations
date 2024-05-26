import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

var camera, scene, renderer, controls, car3d, HUD;
var keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    p: false,
}
var car = {
    pos: new THREE.Vector2(0, 0),
    theta: 0,
    vel: new THREE.Vector2(0, 0),
    omega: 0,
    phi: 0,
    build: {
        C_f: 10000,
        C_r: 10000,
        C_drift: 2000,
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
        F_max: 20000,
        steer_max: Math.PI / 6,
    },
    debug: {
        prevpos: new THREE.Vector2(0, 0),
        lines: new THREE.Group(),
    }
}

window.perf = new Array(100).fill(0)

function three_init() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio( window.devicePixelRatio/2 );
    document.body.appendChild(renderer.domElement);

    //camera
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight);
    camera.position.set(-20/2, 0, 14/2);
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
    controls.keys = {
        LEFT: 'ArrowLeft', //left arrow
        UP: 'ArrowUp', // up arrow
        RIGHT: 'ArrowRight', // right arrow
        BOTTOM: 'ArrowDown' // down arrow
    }

    //scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    //grid
    const gridHelper = new THREE.GridHelper(10000, 300, 0, 0xaaaaaa);
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

    const loader = new FontLoader();

    loader.load('Cousine_Regular.json', function (font) {
        const textMaterial = new THREE.MeshPhongMaterial(
            { color: 0xff0000, specular: 0 }
        );
        let helptext = new TextGeometry('Use WASD to drive', {
            font: font,
            size: 2,
            depth: 1,
            curveSegments: 2,
        });
        let help = new THREE.Mesh(helptext, textMaterial);
        help.position.set(100/3, 14, 0);
        help.scale.set(1, 1, 0.01);
        help.rotation.x = Math.PI / 2;
        help.rotation.y = -Math.PI / 2;
        scene.add(help);

        let hudtext = new TextGeometry('Speed: 0 mph', {
            font: font,
            size: 1,
            depth: 1,
            curveSegments: 2,
        });
        HUD = new THREE.Mesh( hudtext, textMaterial );
        camera.add(HUD);
        HUD.position.set(-2.5, -5, -10);
        HUD.scale.set(0.5, 0.5, 0.003);
        HUD.rotation.x = -0.3;
        // HUD.rotation.y = -Math.PI / 2;
    });

    car3d = new THREE.Object3D();
    car3d.add(bodymesh);
    car3d.add(wheels);
    car3d.add(camera);

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

    scene.add(car.debug.lines);
}


function update(dt) {

    //controls
    let F_u = keys.w ? car.build.F_max : 0 - (keys.s ? car.build.F_max : 0);
    if (keys.p) F_u /= 2;
    car.phi = Math.max(-car.build.steer_max, Math.min(car.build.steer_max, car.phi + (keys.a - keys.d) * dt));
    if (!keys.a && !keys.d) car.phi = car.phi * (1 - dt);


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
    let BtoE = (bx, by, a) => new THREE.Vector2(bx * Math.cos(a) - by * Math.sin(a), bx * Math.sin(a) + by * Math.cos(a)), EtoB = (ex, ey, a) => new THREE.Vector2(ex * Math.cos(a) + ey * Math.sin(a), -ex * Math.sin(a) + ey * Math.cos(a));
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

    let drift = C => (keys.p ? car.build.C_drift : C)*(Math.E**(-Math.sqrt(dx**2+dy**2)/100))
    let alpha_f = phi - Math.atan2(v.y + l_f * omega, v.x);
    let alpha_r = -Math.atan2(v.y - l_r * omega, v.x);
    let C_f = drift(car.build.C_f);  // Cornering stiffness for front tires
    let C_r = drift(car.build.C_r);  // Cornering stiffness for rear tires
    let F_fy = C_f * alpha_f * Math.sqrt(v.x ** 2 + v.y ** 2)
    let F_ry = C_r * alpha_r * Math.sqrt(v.x ** 2 + v.y ** 2);

    let fric=(a) => Math.sqrt(Math.abs(a))*Math.sign(a)
    let F_fx = -fric(v.x) * 100
    let F_rx = -fric(v.x) * 100//(keys.p?-1000:0)

    let dv_x = (F_u * cos(phi) + F_fx * cos(phi) - F_fy * sin(phi) + F_rx) / m + v.y * omega;
    let dv_y = (F_u * sin(phi) + F_fx * sin(phi) + F_fy * cos(phi) + F_ry) / m - v.x * omega;
    let domega = (l_f * ((F_fx + F_u) * sin(phi) + F_fy * cos(phi)) - l_r * F_ry) / I_z;

    let newstate = {
        pos: car.pos.clone().add(car.vel.clone().multiplyScalar(dt)),
        theta: car.theta + car.omega * dt,
        vel: car.vel.clone().add(BtoE(dv_x, dv_y, car.theta).multiplyScalar(dt)),
        omega: car.omega + domega * dt,
        phi: car.phi,
    }

    car.pos = newstate.pos;
    car.theta = newstate.theta;
    car.vel = newstate.vel;
    car.omega = newstate.omega;
    car.phi = newstate.phi;

    //debug
    window.debuga = (Math.E**(-Math.sqrt(dx**2+dy**2)/10));
    if (Math.random() > 0.999) HUD.geometry = new TextGeometry(`Speed: ${(Math.sqrt(dx ** 2 + dy ** 2) * 0.621371).toFixed(1)} mph`, {
        font: HUD.geometry.parameters.options.font,
        size: HUD.geometry.parameters.options.size,
        depth: HUD.geometry.parameters.options.depth,
        curveSegments: HUD.geometry.parameters.options.curveSegments,
    });

    // for (let ch of scene.children) if (ch instanceof THREE.Line && ch.material.color.b * 255 < 0.1) scene.remove(ch);
    // scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(car.pos.x, car.pos.y, 1), new THREE.Vector3(car.pos.x + dx, car.pos.y + dy, 1)]), new THREE.LineBasicMaterial({ color: 1 })));

    if (Math.random() > 0.999) {
        car.debug.lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([car.debug.prevpos, car.pos]), new THREE.LineBasicMaterial({ color: 0 })));
        car.debug.prevpos = car.pos.clone();
    }

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
    perf.push(delta);
    perf.shift();
    for (let i = 0; i < 1000; i++) update(delta / 1000);
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