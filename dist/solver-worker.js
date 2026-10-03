importScripts('vendor/cube.js','vendor/solve.js');
let ready=false;
onmessage=({data})=>{try{if(!ready){postMessage({type:'progress',message:'Preparing the solver for your cube…'});Cube.initSolver();ready=true;}let cube=Cube.fromString(data.state);let algorithm=cube.isSolved()?'':cube.solve();if(!cube.clone().move(algorithm).isSolved())throw new Error('The solution could not be verified. Please try again.');postMessage({type:'solution',algorithm,id:data.id});}catch(e){postMessage({type:'error',message:e.message,id:data.id});}};
