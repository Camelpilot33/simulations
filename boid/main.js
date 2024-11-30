import * as THREE from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

var scene, camera, renderer, controls, boids = [];

class Boid {
    static geometry = new THREE.ConeGeometry(1, 2, 5);
    static material = new THREE.MeshPhongMaterial({ color: 0x00ff00, flatShading: true });
    static red = new THREE.MeshPhongMaterial({ color: 0xff0000, flatShading: true });
    static numBoids = 1000;
    static seperationDistance = 5;
    static alignmentDistance = 8;
    static cohesionDistance = 10;
    static weights = [0.1, 0.1, 0.05];
    static speed = 10;
    static bounds = 50;

    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.id = boids.length;
        this.mesh = new THREE.Mesh(Boid.geometry, this.id?Boid.material:Boid.red);
        scene.add(this.mesh);
    }

    update(dt) {
        //boid logic
        let flock = boids.filter(boid => boid.id !== this.id);
        // 1. separation
        let sepFlock = flock.filter(boid => this.position.distanceTo(boid.position) < Boid.seperationDistance);
        let separation = new THREE.Vector3();
        sepFlock.forEach(boid => {
            let diff = this.position.clone().sub(boid.position);
            separation.add(diff.normalize().divideScalar(diff.length()));
        });
        separation.divideScalar(sepFlock.length || 1);
        separation.normalize();
        separation.multiplyScalar(Boid.weights[0]);
        // 2. alignment
        let alignFlock = flock.filter(boid => this.position.distanceTo(boid.position) < Boid.alignmentDistance);
        let alignment = new THREE.Vector3();
        alignFlock.forEach(boid => {
            alignment.add(boid.velocity);
        });
        alignment.divideScalar(alignFlock.length || 1);
        alignment.normalize();
        alignment.multiplyScalar(Boid.weights[1]);
        // 3. cohesion
        let cohFlock = flock.filter(boid => this.position.distanceTo(boid.position) < Boid.cohesionDistance);
        let cohesion = new THREE.Vector3();
        cohFlock.forEach(boid => {
            cohesion.add(boid.position);
        });
        cohesion.divideScalar(cohFlock.length || 1);
        cohesion.sub(this.position);
        cohesion.normalize();
        cohesion.multiplyScalar(Boid.weights[2]);
        // 4. apply forces
        this.velocity.add(separation);
        this.velocity.add(alignment);
        this.velocity.add(cohesion);
        this.velocity.normalize();

        // // run away from id 0
        // if (this.id !== 0) {
        //     let run = boids[0].position.clone().sub(this.position);
        //     if (run.length() < 30) {
        //         run.normalize();
        //         run.multiplyScalar(-0.1);
        //         this.velocity.add(run);
        //     }
        // }

        //if in range of id 0, turn red
        if (this.position.distanceTo(boids[0].position) < 10) {
            this.mesh.material = Boid.red;
        } else {
            this.mesh.material = Boid.material;
        }


        if (this.position.x > Boid.bounds || this.position.x < -Boid.bounds) {
            this.velocity.x *= Math.sign(this.velocity.x) * (this.position.x > 0 ? -1 : 1);
        }
        if (this.position.y > Boid.bounds || this.position.y < -Boid.bounds) {
            this.velocity.y *= Math.sign(this.velocity.y) * this.position.y > 0 ? -1 : 1;
        }
        if (this.position.z > Boid.bounds || this.position.z < -Boid.bounds) {
            this.velocity.z *= Math.sign(this.velocity.z) * this.position.z > 0 ? -1 : 1;
        }
        this.position.add(this.velocity.clone().multiplyScalar(dt * Boid.speed));
        this.mesh.position.copy(this.position);
        this.mesh.lookAt(this.position.clone().add(this.velocity));
        this.mesh.rotateX(Math.PI / 2);

        // debug line
        // const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        // const points = [];
        // points.push(this.position.clone());
        // points.push(this.position.clone().add(this.velocity.clone().multiplyScalar(1)));
        // const geometry = new THREE.BufferGeometry().setFromPoints(points);
        // const line = new THREE.Line(geometry, material);
        // scene.add(line);
    }

}

function three_init() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    //camera
    camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight);
    camera.position.set(50, 50, 50);
    controls = new OrbitControls(camera, renderer.domElement);
    // controls.enablePan = false;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.5;
    // controls.mouseButtons = {
    //     LEFT: THREE.MOUSE.ROTATE,
    //     MIDDLE: THREE.MOUSE.DOLLY,
    //     RIGHT: THREE.MOUSE.ROTATE,
    // }

    //scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // bounding box
    const geometry = new THREE.BoxGeometry(Boid.bounds * 2, Boid.bounds * 2, Boid.bounds * 2);
    const material = new THREE.MeshBasicMaterial({
        color: 0x202020,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.5,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const lineSegments = new THREE.LineSegments(edges, lineMaterial);
    scene.add(lineSegments);

    // lights
    var light = new THREE.AmbientLight(0xffffff, 1);
    var directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0.1, 0.1, 1.1);

    scene.add(light);
    scene.add(directionalLight);

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);
}

function boid_init() {
    for (let i = 0; i < Boid.numBoids; i++) {
        let boid = new Boid();
        boid.position.set(
            (Math.random() * 2 - 1) * Boid.bounds,
            (Math.random() * 2 - 1) * Boid.bounds,
            (Math.random() * 2 - 1) * Boid.bounds,
        );
        boid.velocity.set(
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
            Math.random() * 2 - 1,
        );
        boid.velocity.normalize();
        boids.push(boid);
    }
}


function update(dt) {
    boids.forEach(boid => {
        boid.update(dt);
    });
}

var clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    let delta = clock.getDelta();
    delta = Math.min(delta, 0.1);
    update(delta);
    controls.update();
    renderer.render(scene, camera);
}


if (WebGL.isWebGLAvailable()) {
    three_init();
    boid_init();
    animate();
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild(warning);
}

window.boids = boids;
window.Boid = Boid;