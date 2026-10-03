import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ORDER,SOLVED,validate,fromString,stickerPose,TURNS,classify,calibrate,rotateFace} from '../dist/engine.mjs';
const require=createRequire(import.meta.url),Cube=require('../dist/vendor/cube.js');require('../dist/vendor/solve.js');
assert.equal(validate(SOLVED,Cube).solved,true);
assert.equal(validate(SOLVED.slice(1),Cube).ok,false);
let flip=SOLVED.split('');[flip[5],flip[10]]=[flip[10],flip[5]];assert.equal(validate(flip.join(''),Cube).ok,false);
let twist=SOLVED.split('');[twist[8],twist[9],twist[20]]=[twist[9],twist[20],twist[8]];assert.equal(validate(twist.join(''),Cube).ok,false);
let swap=SOLVED.split('');[swap[10],swap[19]]=[swap[19],swap[10]];assert.equal(validate(swap.join(''),Cube).ok,false);
let impossible=SOLVED.split('');[impossible[0],impossible[10]]=[impossible[10],impossible[0]];assert.equal(validate(impossible.join(''),Cube).ok,false);
const poses=ORDER.flatMap(f=>Array.from({length:9},(_,i)=>stickerPose(f,Math.floor(i/3),i%3)));
function rotated(v,axis,angle){let [x,y,z]=v,c=Math.round(Math.cos(angle)),s=Math.round(Math.sin(angle));return axis==='x'?[x,y*c-z*s,y*s+z*c]:axis==='y'?[x*c+z*s,y,-x*s+z*c]:[x*c-y*s,x*s+y*c,z];}
const scramble=new Cube().move("R U R' F2 D L2 B U2 R2 F D' L B2 R U' F2");
for(let face of ORDER)for(let suffix of ['',"'",'2']){const move=face+suffix,{axis,sign}=TURNS[face],a='xyz'.indexOf(axis),angle=-sign*Math.PI/2*(suffix==='2'?2:suffix==="'"?-1:1),before=scramble.asString(),result=Array(54);poses.forEach((p,i)=>{let q=p.pos[a]===sign?{pos:rotated(p.pos,axis,angle),normal:rotated(p.normal,axis,angle)}:p;let j=poses.findIndex(t=>t.pos.every((v,k)=>v===q.pos[k])&&t.normal.every((v,k)=>v===q.normal[k]));assert.notEqual(j,-1);result[j]=before[i];});assert.equal(result.join(''),scramble.clone().move(move).asString(),`${move} visual rotation must match solver`);}
Cube.initSolver();for(let i=0;i<12;i++){const c=i===0?scramble.clone():Cube.random();assert.equal(validate(c.asString(),Cube).ok,true);const solution=c.solve();assert.equal(c.clone().move(solution).isSolved(),true);} 
const raw={U:[242,243,234],R:[204,28,26],F:[23,160,67],D:[238,215,32],L:[245,115,26],B:[25,76,184]};for(let f of ORDER)assert.equal(classify(raw[f]).color,f);
const state=scramble.asString(),samples=Object.fromEntries(ORDER.map((f,idx)=>[f,{rgbs:state.slice(idx*9,idx*9+9).split('').map(k=>raw[k])}]));assert.deepEqual(calibrate(samples).faces,fromString(state));
let face=[1,2,3,4,5,6,7,8,9];for(let n=0;n<4;n++)face=rotateFace(face);assert.deepEqual(face,[1,2,3,4,5,6,7,8,9]);
console.log('PASS: 12 complete solves, 18 visual move mappings, invalid pieces/edge flip/corner twist/parity, six-color sampling, calibration, face rotation.');
