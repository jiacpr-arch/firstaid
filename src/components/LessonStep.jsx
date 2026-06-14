import QuizQuestion from './QuizQuestion'
import { LessonImage, LessonVideo } from './Media'

export default function LessonStep({ step, onQuizAnswered }) {
  if (step.type === 'read') {
    return (
      <div className="card">
        {step.heading && <div className="text-headline" style={{ marginBottom: 8 }}>{step.heading}</div>}
        {step.body && <div className="text-body" style={{ whiteSpace: 'pre-wrap' }}>{step.body}</div>}
        {step.image && <LessonImage {...step.image} />}
        {step.video && <LessonVideo {...step.video} />}
      </div>
    )
  }
  if (step.type === 'image') {
    return (
      <div className="card">
        {step.heading && <div className="text-headline" style={{ marginBottom: 8 }}>{step.heading}</div>}
        <LessonImage src={step.src} alt={step.alt} caption={step.caption} />
      </div>
    )
  }
  if (step.type === 'video') {
    return (
      <div className="card">
        {step.heading && <div className="text-headline" style={{ marginBottom: 8 }}>{step.heading}</div>}
        <LessonVideo
          src={step.src}
          youtube={step.youtube}
          poster={step.poster}
          caption={step.caption}
          title={step.alt || step.heading}
        />
      </div>
    )
  }
  if (step.type === 'callout') {
    const cls = step.tone === 'danger' ? 'callout callout-danger'
      : step.tone === 'info' ? 'callout callout-info'
      : 'callout'
    return (
      <div className={cls}>
        {step.heading && <div className="text-body-strong" style={{ marginBottom: 4 }}>{step.heading}</div>}
        <div className="text-body" style={{ whiteSpace: 'pre-wrap' }}>{step.body}</div>
      </div>
    )
  }
  if (step.type === 'quiz') {
    return (
      <QuizQuestion
        question={step.question}
        choices={step.choices}
        correctId={step.correctId}
        explanation={step.explanation}
        onAnswered={onQuizAnswered}
      />
    )
  }
  return null
}
