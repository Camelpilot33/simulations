import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import SplineInterpolation from 'engine/spline_interpolation.js'

class Engine { //sample engine edited from https://github.com/Antonio-R1/engine-sound-generator
    constructor({ xAxisPowerValues = null, yAxisPowerValues = null,
        maxEngineBrakeTorque = 100, momentOfInertia = 2.0, engineFriction = 0.02, minRpm = 750.0, maxRpm = 7500.0 } = {}) {
        this.rpm = 0.0;
        this.throttle = 0.0;
        this._currentThrottle = 0.0;
        if ((xAxisPowerValues == null) !== (yAxisPowerValues == null)) {
            throw new Error('"xAxisPowerValues" and "yAxisPowerValues" need both to be supplied.');
        }

        if (xAxisPowerValues === null) {
            xAxisPowerValues = [0, 1000, 2000, 3500, 7500, 8750, 10000];
            yAxisPowerValues = [0, 35000, 125000, 325000, 735000, 735000, 475000];
        }
        this.powerValues = new SplineInterpolation(xAxisPowerValues, yAxisPowerValues);
        this.maxEngineBrakeTorque = maxEngineBrakeTorque;
        this.momentOfInertia = momentOfInertia;
        this.engineFriction = engineFriction;
        this.minRpm = minRpm;
        this.maxRpm = maxRpm;
        this.starting = false;
        this.started = false;
    }
    start() {
        this.rpm = 0.0;
        this.starting = true;
    }
    update(dt, rpm = this.rpm, load = 0) {
        this.rpm = rpm;
        let throttle = this.throttle;

        if (!this.started || this.rpm < 100.0) {
            throttle = 0.0;
            if (this.rpm < 75.0 && !this.starting) {
                this.rpm = 0.0;
                this.currentPower = 0.0;
                return;
            }
        }
        else if (this.rpm < this.minRpm) {
            throttle = 0.35;
        }

        if (this.starting) {
            this.started = true;
            if (this.rpm < 100.0) {
                this.rpm += 200.0 * dt;
                throttle = 1.0;
            }
            else this.starting = false;
        }
        if (this.rpm > this.maxRpm) throttle = 0.0;

        let exponent = 0.5 + 1.5 * (this.rpm - this.minRpm) / (this.maxRpm - this.minRpm);
        let powerPercentage = Math.pow(throttle, exponent);
        let omega = this.rpm / 60.0 * 2 * Math.PI;
        let torqueEngine = powerPercentage * (this.powerValues.evaluate(this.rpm) / omega + this.maxEngineBrakeTorque) -
            this.maxEngineBrakeTorque;

        /*
         * L: angular momentum
         * I: momentum of inertia
         * omega: angular velocity
         * P: power
         * M: torque
         * L = I*omega
         * L = M*dt
         * M = P/omega
         */
        let angularMomentum = omega * this.momentOfInertia;
        let torqueFriction = this.engineFriction;

        angularMomentum = angularMomentum + (torqueEngine - torqueFriction - load) * dt;
        this.rpm = angularMomentum / this.momentOfInertia * 60.0 / (2 * Math.PI);

        return (torqueEngine - torqueFriction);
    }
}

var camera, scene, renderer, controls, car3d, HUD, frameId;
window.freeze = () => { cancelAnimationFrame(frameId) }
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
    gear: 0,
    engine: new Engine(),
    build: {
        gears: [0, 11, 7, 5, 3],
        I_z: 140,
        mass: 1000,
        wheels: {
            lf: 0.9,
            lr: 1.5,
            ydist2: 0.63,
            h: 0.3,
            geom: [0.4, 0.4, 0.3, 20]
        },
        body: [3.5, 1.5, 0.6],
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
    renderer.setPixelRatio(window.devicePixelRatio / 2);
    document.body.appendChild(renderer.domElement);

    //camera
    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight);
    camera.position.set(-20 / 2, 0, 14 / 2);
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
    scene.background = new THREE.Color(0);

    //grid
    const gridHelper = new THREE.GridHelper(10000, 1000, 0xffffff, 0x444444);
    gridHelper.rotation.x = Math.PI / 2;

    // car
    let bodymat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    let wheelmat = new THREE.MeshNormalMaterial();

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
        const textMaterial = new THREE.MeshNormalMaterial(
            //{ color: 0xff00, specular: 0 }
        );
        let helptext = new TextGeometry('Use WASD to drive', {
            font: font,
            size: 2,
            depth: 1,
            curveSegments: 2,
        });
        let help = new THREE.Mesh(helptext, textMaterial);
        help.position.set(100 / 3, 14, 0);
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
        HUD = new THREE.Mesh(hudtext, textMaterial);
        camera.add(HUD);
        HUD.position.set(-1.4, -5, -10);
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
    let m = car.build.mass;
    let I_z = car.build.I_z;
    let l_f = car.build.wheels.lf;
    let l_r = car.build.wheels.lr;
    let phi = car.phi;
    let theta = car.theta;
    let omega = car.omega;
    let dx = car.vel.x;
    let dy = car.vel.y;
    let speed = Math.sqrt(dx ** 2 + dy ** 2);
    let BtoE = (bx, by, a) => new THREE.Vector2(bx * Math.cos(a) - by * Math.sin(a), bx * Math.sin(a) + by * Math.cos(a)), EtoB = (ex, ey, a) => new THREE.Vector2(ex * Math.cos(a) + ey * Math.sin(a), -ex * Math.sin(a) + ey * Math.cos(a));
    let cos = Math.cos;
    let sin = Math.sin;
    let v = EtoB(dx, dy, theta)

    let mu_static = 20; // Static coefficient of friction (tune as needed)
    let k = 0.05; // Decrease rate of friction with speed (tune as needed)
    let N_f = car.build.mass / 2; // Normal force on the front tires (tune as needed)
    let N_r = car.build.mass / 2; // Normal force on the rear tires (tune as needed)\
    let alpha_f = phi - Math.atan2(v.y + l_f * omega, v.x);
    let alpha_r = -Math.atan2(v.y - l_r * omega, v.x);
    let mu_effective = mu_static - k * speed;
    let C_f = mu_effective * N_f;
    let C_r = mu_effective * N_r;

    //TODO: Fix grip
    // let drift = C => (keys.p ? car.build.C_drift : C) * (Math.E ** (-Math.sqrt(dx ** 2 + dy ** 2) / 100))
    // let C_f = drift(car.build.C_f);  // Cornering stiffness for front tires
    // let C_r = drift(car.build.C_r);  // Cornering stiffness for rear tires
    let F_fy = C_f * alpha_f * speed;
    let F_ry = C_r * alpha_r * speed;
    let fric = (a) => Math.sqrt(Math.abs(a)) * Math.sign(a);
    let F_fx = -fric(v.x) * 100 - keys.s * 3000 * Math.sign(v.x);
    let F_rx = -fric(v.x) * 100 - keys.s * 1500 * Math.sign(v.x);

    //gearbox
    if (keys['0']) car.gear = 0;
    if (keys['1']) car.gear = 1;
    if (keys['2']) car.gear = 2;
    if (keys['3']) car.gear = 3;
    if (keys['4']) car.gear = 4;
    car.engine.throttle = keys.w ? 0.5 : 0;
    let actualrpm = speed * 60 / (2 * Math.PI * car.build.wheels.h) * car.build.gears[car.gear];
    actualrpm = Math.max(100, Math.min(10000, actualrpm))

    let torqueEngine, F_u;
    if (car.gear == 0) {
        torqueEngine = car.engine.update(dt)
        F_u = 0
    } else {
        torqueEngine = car.engine.update(dt, actualrpm, F_fx * car.build.wheels.h);
        F_u = torqueEngine * car.build.gears[car.gear] / car.build.wheels.h;
    }

    car.phi = Math.max(-car.build.steer_max, Math.min(car.build.steer_max,
        car.phi + (2 - (Math.abs(car.phi) ** 4) / car.build.steer_max) * (1 / (1.5 + 2 ** (2 * speed / 10 - 4)) + 9 / 25) * (keys.a - keys.d) * dt
    ));
    if (!keys.a && !keys.d) car.phi = car.phi * (1 - dt);

    // car.engine.load = F_u;

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
    window.debuga = torqueEngine//[C_f,C_r];

    // for (let ch of scene.children) if (ch instanceof THREE.Line && ch.material.color.b * 255 < 0.1) scene.remove(ch);
    // scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(car.pos.x, car.pos.y, 1), new THREE.Vector3(car.pos.x + dx, car.pos.y + dy, 1)]), new THREE.LineBasicMaterial({ color: 1 })));

    // if (Math.random() > 0.999) {
    //     car.debug.lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([car.debug.prevpos, car.pos]), new THREE.LineBasicMaterial({ color: 0 })));
    //     car.debug.prevpos = car.pos.clone();
    // }

    //update car
    car3d.rotation.z = car.theta;
    car3d.position.set(car.pos.x, car.pos.y, 0);
    car3d.children[1].children[0].rotation.z = car.phi;
    car3d.children[1].children[2].rotation.z = car.phi;
}

var clock = new THREE.Clock();
var delta = 0;
function animate() {
    frameId = requestAnimationFrame(animate);
    delta = clock.getDelta();
    perf.push(delta);
    perf.shift();

    delta = Math.max(1e-3, Math.min(0.1, delta));
    for (let i = 0; i < 1000; i++) {
        update(delta / 1000);
    }
    try {
        HUD.geometry = new TextGeometry(
            `${(car.vel.length() * 2.237).toFixed(1)} mph\n${car.gear} / ${car.engine.rpm.toFixed(0)}`,
            {
                font: HUD.geometry.parameters.options.font,
                size: HUD.geometry.parameters.options.size,
                depth: HUD.geometry.parameters.options.depth,
                curveSegments: HUD.geometry.parameters.options.curveSegments,
            })
    } catch (e) { }
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
    car.engine.start()
    animate();
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
}

window.car = car;
window.exec = (str) => { return eval(str) };
window.scene = scene;