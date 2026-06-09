// Single-mode config for firstaid. Kept structured like acls-emr's courseMode so
// downstream components can read `courseMeta.*` uniformly.

export const COURSE_MODE = 'firstaid'
export const IS_FIRSTAID = true

export const courseMeta = {
  id: 'firstaid',
  title: 'ปฐมพยาบาลเบื้องต้น',
  titleTh: 'หลักสูตรปฐมพยาบาลเบื้องต้นสำหรับประชาชน',
  shortName: 'First Aid',
  standard: 'TH-FirstAid-Layperson-2026',
  themeColor: '#16A34A',
  passingScore: { lesson: 70, postTest: 80 },
  certTemplate: 'firstaid-th-2026',
  certValidityMonths: 24,
  emergencyNumber: '1669',
}
