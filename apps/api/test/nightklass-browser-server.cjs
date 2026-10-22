// Isolated browser-test server only. Never imported by the production application.
require('reflect-metadata')
const {randomUUID,createHash}=require('node:crypto')
const {NestFactory}=require('@nestjs/core')
const {PrismaClient}=require('../../../packages/db/generated/client')
const {hash}=require('bcryptjs')
const url=new URL(process.env.DATABASE_URL||'postgresql://invalid/invalid')
if(url.pathname!=='/nightklass_exam_test'||!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Browser fixtures require the isolated local nightklass_exam_test database')
process.env.JWT_SECRET=randomUUID()+randomUUID();process.env.JWT_REFRESH_SECRET=randomUUID()+randomUUID()
process.env.API_URL='http://127.0.0.1:3101';process.env.OPENAI_API_KEY='';process.env.R2_ACCESS_KEY_ID='';process.env.R2_ENDPOINT='';process.env.EXAM_ACCESS='OPEN'
const prisma=new PrismaClient(),suffix=randomUUID().slice(0,8),password='Browser-test-only-42!'
async function start(){
  const passwordHash=await hash(password,12)
  const account=name=>prisma.user.create({data:{name,email:`browser-${name}-${suffix}@example.test`,passwordHash,role:'STUDENT',status:'ACTIVE',studyPathway:'EXAM_PREPARATION',secondaryStage:'SS3',country:'Nigeria',institutionType:'SECONDARY_SCHOOL',profileCompletedAt:new Date()}})
  const owner=await account('teacher'),learner=await account('learner')
  await prisma.nightklassAdmin.create({data:{userId:owner.id,role:'OWNER'}})
  const subjects=['English Language','Government','Literature in English','Economics'],keys=['english','government','literature in english','economics']
  const courses=[]
  for(let i=0;i<subjects.length;i++)courses.push(await prisma.course.create({data:{ownerId:learner.id,title:subjects[i],subject:subjects[i],examSubjectKey:keys[i],description:'Nigerian senior secondary exam preparation browser fixture.'}}))
  const goal=await prisma.examGoal.create({data:{studentId:learner.id,exam:'JAMB',year:2099,subjects:{create:subjects.map((name,i)=>({name,subjectKey:keys[i],courseId:courses[i].id}))}}})
  const waecGoal=await prisma.examGoal.create({data:{studentId:learner.id,exam:'WAEC',year:2099,series:'SCHOOL',subjects:{create:[{name:'Government',subjectKey:'government',courseId:courses[1].id}]}}})
  const options=[{key:'A',text:'Citizens elect representatives'},{key:'B',text:'All power is inherited'},{key:'C',text:'Citizens never vote'},{key:'D',text:'Only one person owns all power'}]
  const questions=[]
  for(let i=0;i<subjects.length;i++){
    const text=`Browser fixture ${suffix}: ${subjects[i]} — choose the representative democracy answer.`
    questions.push(await prisma.examBankQuestion.create({data:{exam:'JAMB',subject:subjects[i],subjectKey:keys[i],topic:'Democratic government',questionText:text,questionType:'MCQ',options,correctAnswer:'A',explanation:'Representative democracy lets citizens elect representatives.',marks:1,difficulty:'MEDIUM',status:'APPROVED',createdById:owner.id,reviewedById:owner.id,fingerprint:createHash('sha256').update(text).digest('hex')}}))
  }
  await prisma.examMockTemplate.upsert({where:{year:2099},create:{year:2099,title:'Browser fixture short JAMB mock',durationMinutes:120,englishCount:1,otherCount:1,instructions:'This isolated browser fixture uses four questions. Production templates use verified exam-year rules.',sourceNote:'Isolated browser fixture, not a real exam specification.',status:'APPROVED'},update:{status:'APPROVED',englishCount:1,otherCount:1}})
  const previous=await prisma.examSyllabus.findFirst({where:{exam:'JAMB',year:2099,subjectKey:'government'},orderBy:{version:'desc'}})
  await prisma.examSyllabus.updateMany({where:{exam:'JAMB',year:2099,subjectKey:'government',status:'APPROVED'},data:{status:'ARCHIVED'}})
  const syllabus=await prisma.examSyllabus.create({data:{exam:'JAMB',year:2099,subject:'Government',subjectKey:'government',version:(previous?.version??0)+1,title:'Browser Government Syllabus',provenance:'CURATED',sourceNote:'Teacher-curated isolated browser fixture.',status:'APPROVED',objectives:{create:[{code:'GOV-01',title:'Democratic government',description:'Explain representative democracy and accountability.',order:0}] }},include:{objectives:true}})
  await prisma.examQuestionObjective.create({data:{questionId:questions[1].id,objectiveId:syllabus.objectives[0].id}})
  const waecIds=[]
  for(let i=0;i<3;i++){const text=`Browser WAEC fixture ${suffix} ${i}: ${i===0?'Choose the democracy answer.':'(a) Define democracy. (b) Explain accountability.'}`;waecIds.push(await prisma.examBankQuestion.create({data:{exam:'WAEC',subject:'Government',subjectKey:'government',topic:`Browser ${suffix}`,questionText:text,questionType:i===0?'MCQ':'THEORY',options:i===0?options:[],correctAnswer:i===0?'A':'A definition and an explanation of accountability.',explanation:i===0?'Citizens elect representatives.':'Definition: four marks. Explanation: six marks.',marks:i===0?1:10,difficulty:'MEDIUM',status:'APPROVED',createdById:owner.id,reviewedById:owner.id,fingerprint:createHash('sha256').update(text).digest('hex')}}))}
  const paper=await prisma.waecPaperTemplate.create({data:{year:2099,series:'SCHOOL',subject:'Government',subjectKey:'government',paperCode:`BROWSER-${suffix}`,title:`Browser WAEC Government ${suffix}`,durationMinutes:60,instructions:'Answer the objective and select exactly one essay. Label your working and subparts.',sourceNote:'Illustrative browser fixture only; not an official WAEC paper.',status:'APPROVED',sections:[{id:'a',title:'Compulsory objective',questionType:'MCQ',count:1,choose:1,marks:1,topic:`Browser ${suffix}`},{id:'b',title:'Choose one essay',questionType:'THEORY',count:2,choose:1,marks:10,topic:`Browser ${suffix}`}]}})
  const {AppModule}=require('../dist/app.module'),{AiService}=require('../dist/modules/ai/ai.service')
  const app=await NestFactory.create(AppModule,{logger:false})
  require('../dist/configure-app').configureApp(app,['http://127.0.0.1:3102'])
  const ai=app.get(AiService)
  ai.gradeWrittenAnswers=async answers=>({model:'browser-fixture',promptVersion:'browser-fixture',grades:answers.map(a=>({id:a.id,score:a.marks/2,feedback:'Browser fixture: definition is partly correct; develop the explanation.',missingPoints:['Expand accountability']}))})
  ai.generateQuestionsWithMeta=async(_text,opts)=>({model:'browser-fixture',promptVersion:'browser-fixture',questions:Array.from({length:opts.count},(_,i)=>({type:'MCQ',questionText:`Browser generated fixture ${suffix} ${randomUUID()} ${i}: choose the democracy answer.`,options,correctAnswer:'A',explanation:'Representative democracy lets citizens elect their representatives.'}))})
  app.getHttpAdapter().get('/__test/fixtures',(_req,res)=>res.json({teacher:owner.email,learner:learner.email,password,jambGoal:goal.id,waecGoal:waecGoal.id,paperTitle:paper.title,objectiveId:syllabus.objectives[0].id,suffix}))
  await app.listen(3101,'127.0.0.1')
  const stop=async()=>{await app.close();await prisma.$disconnect();process.exit(0)}
  process.on('SIGTERM',stop);process.on('SIGINT',stop)
}
start().catch(err=>{console.error(err.message);process.exit(1)})
