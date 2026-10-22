const fs=require('node:fs')
const {summarizeCalibration}=require('../dist/modules/exam-preparation/exam-calibration.rules')
try{
  if(process.argv.length!==3)throw new Error('Usage: node apps/api/scripts/exam-marking-calibration.cjs <anonymized-paired-scores.json>')
  const samples=JSON.parse(fs.readFileSync(process.argv[2],'utf8'))
  if(!Array.isArray(samples))throw new Error('Input must be a JSON array of paired teacher/AI scores')
  console.log(JSON.stringify(summarizeCalibration(samples),null,2))
}catch(err){console.error(err.message);process.exitCode=1}
