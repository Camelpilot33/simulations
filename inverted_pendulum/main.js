Number.prototype.mod = function (n) { return ((this % n) + n) % n; };
Number.prototype.clamp = function (lo,hi) { return Math.max(lo,Math.min(hi,this)) };
var canvas = document.getElementById("display");
canvas.style.backgroundColor = "#000";
var ctx = canvas.getContext("2d");
let [width, height] = [canvas.width, canvas.height];

let state = {
    x:0,
    Dx:1,
    a:0,
    Da:1,
    b:0,
    Db:0
}
let build = {
    m0:1,
    m1:1,
    m2:1,
    l:1,
    limits:900
}


function draw() {
    let scalefactor = 50

    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = "#0f0"
    ctx.moveTo((width-build.limits)/2,height/2)
    ctx.lineTo((width+build.limits)/2,height/2)
    ctx.stroke();

    let [ox,oy] = [width/2+state.x*scalefactor,height/2]
    
    //body
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#000";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(ox,oy,5,0,2*Math.PI,false);
    ctx.stroke();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(ox,oy);
    ctx.lineTo(ox+build.l*scalefactor*Math.cos(state.a+Math.PI/2),oy+build.l*scalefactor*Math.sin(state.a+Math.PI/2));
    ctx.stroke();

    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#000";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.arc(ox+build.l*scalefactor*Math.cos(state.a+Math.PI/2),oy+build.l*scalefactor*Math.sin(state.a+Math.PI/2),5,0,2*Math.PI,false);
    ctx.stroke();
    ctx.fill();
}

function update(dt) {
    
    state.a+=state.Da*dt
    state.x+=state.Dx*dt
    state.x=state.x.clamp(-5,5)
}


//Key handling
var keys = {
};
document.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});
document.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});


//Animation loop
let tn=Date.now();
function animate() {
    let delta = (Date.now()-tn)/1000;
    tn = Date.now();
    frameId = requestAnimationFrame(animate);
    draw();
    update(delta)
}
animate()


