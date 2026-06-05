# Rekap Individu (Individual Student Recap) - Feature Documentation

**Last Updated:** May 24, 2026  
**Feature Status:** Production  
**Complexity Level:** High  
**Lines of Code:** ~2,000+ (Frontend + Backend)

---

## 1. Feature Overview

**Rekap Individu** is a comprehensive student performance summary system that provides teachers and administrators with a detailed individual student recap including:

- Academic performance (grades by subject)
- Attendance tracking (presence, sick leave, permission, absence)
- Discipline records (infractions and points)
- Character assessment (8-dimensional radar chart)
- AI-generated narrative analysis
- Parent communication messages
- PDF export with digital signatures

### Key Stakeholders
- **Teachers:** Generate student recaps, write narratives, communicate with parents
- **Administrators:** Monitor student performance, generate reports
- **Parents:** View student progress (via student portal)
- **Students:** Access their own performance data

---

## 2. Architecture Overview

### Frontend Stack
- **Framework:** React 18 with Vite
- **Main Component:** `RekapIndividuPage.jsx` (1,088 lines)
- **UI Library:** Tailwind CSS + Lucide React icons
- **State Management:** React hooks (useState, useEffect, useMemo, useCallback)
- **Data Visualization:** Recharts (Radar chart), custom PieChart
- **PDF Generation:** html2canvas + jsPDF
- **AI Integration:** Gemini API via custom utilities

### Backend Stack
- **Framework:** Laravel 10
- **Main Controller:** `StudentDashboardController.php` (756 lines)
- **API Type:** RESTful with Sanctum authentication
- **Caching:** Redis (5-minute cache for student data)
- **Database:** MySQL with eager loading optimization

### Data Flow Diagram
```
User (Teacher/Admin)
    ↓
RekapIndividuPage.jsx (Frontend)
    ├─ Select Class → /api/classes
    ├─ Select Student → /api/students
    ├─ Fetch Grades → /api/grades/summary/{student_id}
    ├─ Fetch Attendance → /api/attendances
    ├─ Fetch Infractions → /api/infractions
    ├─ Fetch Notes → /api/student-notes
    └─ Generate Narrative → Gemini API
        ↓
StudentDashboardController.php (Backend)
    ├─ Calculate grade statistics
    ├─ Aggregate attendance data
    ├─ Compute infraction points
    ├─ Generate radar data
    └─ Return comprehensive summary
        ↓
Database (MySQL)
    ├─ grades table
    ├─ attendances table
    ├─ infractions table
    ├─ students table
    └─ student_notes table
```

---

## 3. Frontend Components & Features

### 3.1 Main Component: RekapIndividuPage.jsx

**Location:** `resources/js/pages/RekapIndividuPage.jsx`

**Key State Variables:**
```javascript
const [selectedClass, setSelectedClass] = useState('');           // Selected class (rombel)
const [selectedStudentId, setSelectedStudentId] = useState('');   // Selected student ID
const [selectedStudent, setSelectedStudent] = useState(null);     // Full student object
const [selectedSubject, setSelectedSubject] = useState('');       // Subject filter
const [grades, setGrades] = useState([]);                         // Raw grades data
const [gradesData, setGradesData] = useState(null);               // Summary data from API
const [attendance, setAttendance] = useState([]);                 // Attendance records
const [infractions, setInfractions] = useState([]);               // Infraction records
const [narrativeNote, setNarrativeNote] = useState('');           // AI-generated narrative
const [parentMessage, setParentMessage] = useState('');           // Parent communication message
const [stats, setStats] = useState({...});                        // Calculated statistics
const [radarData, setRadarData] = useState({...});                // 8-dimensional character data
```

**Key Functions:**

1. **handleExportPDF()** - Exports student recap as PDF
   - Captures radar chart as image
   - Includes narrative and parent message
   - Adds digital signature with location
   - Uses `generateStudentIndividualRecapPDF()` utility

2. **handleSaveNarrative()** - Saves narrative note to database
   - Endpoint: `POST /api/student-notes`
   - Stores narrative for future reference

3. **handleGenerateNarrative()** - AI-powered narrative generation
   - Calls `generateStudentNarrative()` utility
   - Uses Gemini API with student data context
   - Auto-saves if `isAutoSave=true`

4. **handleGenerateParentMessage()** - Creates parent communication
   - Calls `generateParentMessage()` utility
   - Generates personalized message based on narrative
   - Copyable to clipboard

5. **handleDetectLocation()** - Geolocation detection
   - Uses browser Geolocation API
   - Reverse geocoding via Nominatim
   - Stores in localStorage for signing location

### 3.2 Data Fetching Flow

**Step 1: Load Classes**
```javascript
useEffect(() => {
    api.get('/classes?all=true')
        .then(res => setClasses(res.data.data))
}, []);
```

**Step 2: Load Students by Class**
```javascript
useEffect(() => {
    if (selectedClass) {
        api.get('/students', { params: { rombel: selectedClass } })
            .then(res => setStudents(res.data.data))
    }
}, [selectedClass]);
```

**Step 3: Load All Student Data (Parallel)**
```javascript
useEffect(() => {
    Promise.all([
        api.get('/grades', { params: { student_id, semester, academic_year } }),
        api.get(`/grades/summary/${student_id}`, { params: { semester, academic_year } }),
        api.get('/attendances', { params: { student_id, semester, academic_year } }),
        api.get('/infractions', { params: { student_id, semester, academic_year } }),
        api.get('/student-notes', { params: { student_id, semester, academic_year } })
    ])
}, [selectedStudentId]);
```

### 3.3 Statistics Calculation

**Computed Stats:**
```javascript
const stats = {
    academicAvg: average of all subject grades,
    attitudeScore: average attitude score (100 - infraction_points),
    attitudePredicate: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Kurang',
    totalInfractionPoints: sum of all infraction points,
    attendance: {
        Hadir: present count,
        Sakit: sick leave count,
        Ijin: permission count,
        Alpha: absence count,
        schoolDays: total school days,
        pct_hadir: attendance percentage
    },
    finalScore: overall_nilai_akhir (weighted average),
    academicWeight: 50% (default),
    attitudeWeight: 50% (default),
    radarData: {
        "Keimanan": 85,
        "Kewargaan": 85,
        "Penalaran Kritis": 85,
        "Kreativitas": 85,
        "Kolaborasi": 85,
        "Kemandirian": 85,
        "Kesehatan": 85,
        "Komunikasi": 85
    }
};
```

### 3.4 UI Sections

1. **Selection Header**
   - Class selector dropdown
   - Student selector dropdown
   - Signing location input with geolocation detection
   - Back button

2. **Student Grid** (when class selected)
   - Shows all students in class as clickable cards
   - Displays student name and NIS
   - Hover effects for better UX

3. **Summary Cards**
   - Academic Average
   - Attitude Score with predicate
   - Attendance percentage
   - Infraction points
   - Final Score

4. **Radar Chart**
   - 8-dimensional character assessment
   - Visual representation of student strengths/weaknesses
   - Exportable as image for PDF

5. **Grades Table**
   - Subject-wise grade breakdown
   - Grade types (Harian, Tugas, Kuis, Formatif, Sumatif, etc.)
   - Subject filter capability

6. **Attendance Table**
   - Daily attendance records
   - Status breakdown (Hadir, Sakit, Ijin, Alpa)
   - Percentage calculation

7. **Infractions Table**
   - Discipline records
   - Infraction type and points
   - Date and description

8. **Narrative Section**
   - AI-generated student analysis
   - Editable text area
   - Save and regenerate buttons
   - Markdown support with KaTeX for math

9. **Parent Message Section**
   - AI-generated parent communication
   - Copy to clipboard functionality
   - Personalized tone

10. **Export Section**
    - PDF export button
    - Includes all data and charts
    - Digital signature with location and date

---

## 4. Backend Implementation

### 4.1 StudentDashboardController.php

**Location:** `app/Http/Controllers/Api/StudentDashboardController.php`

**Key Methods:**

1. **getStudent()** - Retrieves authenticated student
   - Caches for 5 minutes
   - Returns student with class relationship

2. **getSchoolName()** - Gets school name from admin profile
   - Caches for 1 hour
   - Fallback to config value

3. **getPlannedMaterial()** - Gets planned material from Promes
   - Matches date and week to teaching program
   - Returns material for specific subject/date

4. **getRealtimeLearning()** - Current learning session
   - Determines current/upcoming class
   - Includes attendance status
   - Returns planned material

5. **getWeeklySchedule()** - Student's weekly timetable
   - Returns all teaching sessions
   - Resolves teacher names from assignments

6. **getAttendanceRecap()** - Attendance summary
   - Groups by subject
   - Calculates percentages
   - Returns daily details

7. **getGrades()** - Grade summary
   - Filters by semester/academic year
   - Groups by subject
   - Calculates averages

### 4.2 Grade Calculation Service

**Location:** `app/Services/GradeCalculationService.php`

**Key Calculations:**

1. **calculateStudentGrades()**
   - Aggregates grades by subject
   - Calculates weighted averages
   - Determines final score

2. **calculateAttitudeScore()**
   - Based on infractions
   - Formula: 100 - total_infraction_points
   - Capped at 100

3. **calculateRadarData()**
   - 8 dimensions of character
   - Based on grades, attendance, infractions
   - Normalized to 0-100 scale

### 4.3 API Endpoints

**Grade Summary Endpoint:**
```
GET /api/grades/summary/{student_id}
Query Parameters:
  - semester: 'Ganjil' | 'Genap'
  - academic_year: '2025/2026'

Response:
{
  "by_subject": [
    {
      "subject_name": "Matematika",
      "nilai_akademik": 85.5,
      "nilai_sikap": 90,
      "nilai_keterampilan": 88,
      "grades": [...]
    }
  ],
  "overall_nilai_akhir": 87.5,
  "attendance_summary": {
    "hadir": 45,
    "sakit": 2,
    "izin": 1,
    "alpa": 0,
    "school_days": 48,
    "pct_hadir": 93.75
  },
  "infraction_summary": {
    "total_points": 5,
    "count": 2
  },
  "radar_data": {...},
  "weights": {
    "academic": 50,
    "attitude": 50,
    "knowledge": 40,
    "practice": 60
  },
  "warnings": []
}
```

---

## 5. AI Integration (Gemini)

### 5.1 Narrative Generation

**Utility Function:** `generateStudentNarrative()` in `utils/gemini.js`

**Input Data:**
```javascript
{
  studentName: "Budi Santoso",
  grades: [...],           // All grades
  attendance: [...],       // Attendance records
  infractions: [...],      // Discipline records
  stats: {
    academicAvg: 85.5,
    attitudeScore: 90,
    totalInfractionPoints: 5,
    attendance: {...}
  }
}
```

**Prompt Template:**
```
Buatkan narasi penilaian siswa [studentName] berdasarkan data berikut:
- Rata-rata nilai akademik: [academicAvg]
- Nilai sikap: [attitudeScore]
- Kehadiran: [attendance]%
- Poin pelanggaran: [totalInfractionPoints]

Narasi harus:
1. Objektif dan berbasis data
2. Mengidentifikasi kekuatan siswa
3. Menyebutkan area yang perlu perbaikan
4. Memberikan rekomendasi tindak lanjut
5. Menggunakan bahasa yang profesional namun mudah dipahami
```

**Output:** Markdown-formatted narrative (1-2 paragraphs)

### 5.2 Parent Message Generation

**Utility Function:** `generateParentMessage()` in `utils/gemini.js`

**Input Data:**
```javascript
{
  studentName: "Budi Santoso",
  narrativeNote: "...",    // Generated narrative
  stats: {...},            // Student statistics
  teacherName: "Ibu Siti"
}
```

**Prompt Template:**
```
Buatkan pesan singkat dari guru [teacherName] kepada orang tua siswa [studentName].

Pesan harus:
1. Ramah dan profesional
2. Merangkum pencapaian siswa
3. Menyebutkan area yang perlu perhatian
4. Mengajak orang tua berkolaborasi
5. Singkat (3-4 kalimat)

Narasi siswa: [narrativeNote]
```

**Output:** Plain text message (3-4 sentences)

### 5.3 Caching Strategy

- Journal analysis: 1 hour cache (keyed by content hash)
- Student performance: 5 minute cache (per student)
- No caching for narrative generation (always fresh)

---

## 6. PDF Export

### 6.1 PDF Generation Utility

**Location:** `utils/pdfGenerator.js`

**Function:** `generateStudentIndividualRecapPDF()`

**Includes:**
1. Student header (name, NIS, class, date)
2. Summary statistics (grades, attendance, infractions)
3. Radar chart image
4. Grades table
5. Attendance table
6. Infractions table
7. Narrative section
8. Parent message section
9. Digital signature (teacher name, location, date)

**PDF Dimensions:** A4 (210mm × 297mm)

**Font:** Arial/Helvetica

**Colors:** Blue (#3B82F6) for headers, gray for text

---

## 7. Data Models

### 7.1 Grade Model
```php
class Grade extends Model {
    protected $fillable = [
        'student_id',
        'subject_id',
        'class_id',
        'score',
        'type',           // 'Harian', 'Tugas', 'Kuis', 'Formatif', 'Sumatif', etc.
        'date',
        'semester',
        'academic_year',
        'topic',
        'notes'
    ];
}
```

### 7.2 Attendance Model
```php
class Attendance extends Model {
    protected $fillable = [
        'student_id',
        'subject_id',
        'date',
        'status',         // 'hadir', 'sakit', 'izin', 'alpa'
        'note',
        'semester',
        'academic_year'
    ];
}
```

### 7.3 Infraction Model
```php
class Infraction extends Model {
    protected $fillable = [
        'student_id',
        'infraction_type_id',
        'date',
        'description',
        'points',
        'semester',
        'academic_year'
    ];
}
```

### 7.4 StudentNote Model
```php
class StudentNote extends Model {
    protected $fillable = [
        'student_id',
        'note',
        'semester',
        'academic_year',
        'created_by'
    ];
}
```

---

## 8. Performance Considerations

### 8.1 Optimization Techniques

1. **Eager Loading**
   - Grades loaded with subject relationships
   - Prevents N+1 query problems

2. **Caching**
   - Student data: 5 minutes
   - School name: 1 hour
   - Teaching programs: 1 hour

3. **Parallel Data Fetching**
   - Frontend uses Promise.all() for concurrent requests
   - Reduces total load time

4. **Pagination**
   - Attendance/grades limited to current semester
   - Reduces data transfer

### 8.2 Performance Metrics

**Typical Load Times:**
- Class list: 100ms
- Student list: 200ms
- Student data (all): 500-800ms
- PDF generation: 2-3 seconds
- Narrative generation: 5-10 seconds (Gemini API)

**Database Queries:**
- Per student recap: ~8-10 queries
- With caching: ~2-3 queries

---

## 9. Known Issues & Limitations

### 9.1 Issues

1. **Large Controller Size**
   - StudentDashboardController: 756 lines
   - Should be split into multiple services

2. **Missing Error Handling**
   - No validation for invalid student IDs
   - Gemini API failures not gracefully handled

3. **Geolocation Privacy**
   - Requires user permission
   - May fail on private browsing mode

4. **PDF Export Performance**
   - Large PDFs (>5MB) may cause browser lag
   - No progress indicator

5. **Narrative Generation Latency**
   - Gemini API calls take 5-10 seconds
   - No timeout handling

### 9.2 Limitations

1. **Single Semester View**
   - Cannot compare across semesters
   - No historical trend analysis

2. **No Bulk Export**
   - Can only export one student at a time
   - No batch PDF generation

3. **Limited Customization**
   - Radar dimensions hardcoded (8 dimensions)
   - Cannot customize weights per school

4. **No Audit Trail**
   - No logging of who accessed which student's data
   - No tracking of narrative modifications

---

## 10. Security Considerations

### 10.1 Authorization

**Current Implementation:**
- Sanctum token-based authentication
- Role-based access (teacher, admin, student)
- No explicit student data access control

**Issues:**
- Teachers can access any student's data
- No class-level authorization check
- Students can access their own data only (via student portal)

**Recommendations:**
- Add middleware to verify teacher teaches the class
- Implement student data access logging
- Add audit trail for sensitive operations

### 10.2 Data Privacy

**Sensitive Data:**
- Student grades (academic performance)
- Attendance records (presence tracking)
- Infraction records (discipline history)
- Narrative notes (subjective assessments)

**Current Protection:**
- HTTPS encryption (assumed)
- Database access control
- No field-level encryption

**Recommendations:**
- Encrypt sensitive fields in database
- Implement data retention policies
- Add GDPR compliance for data deletion

---

## 11. Testing

### 11.1 Test Coverage

**Current Status:** No visible test files

**Recommended Tests:**

1. **Unit Tests**
   - Grade calculation logic
   - Attendance percentage calculation
   - Infraction point aggregation

2. **Integration Tests**
   - API endpoint responses
   - Database queries
   - Caching behavior

3. **E2E Tests**
   - Student selection flow
   - Data loading and display
   - PDF export functionality
   - Narrative generation

### 11.2 Test Data

**Needed:**
- Sample students with various grade distributions
- Attendance records (present, absent, sick, permission)
- Infraction records with different point values
- Multiple semesters of data

---

## 12. Future Enhancements

### 12.1 Short Term (1-2 sprints)

1. **Bulk Export**
   - Export multiple students' recaps as ZIP
   - Batch PDF generation

2. **Comparison View**
   - Compare student with class average
   - Trend analysis across semesters

3. **Customizable Radar**
   - Allow schools to define custom dimensions
   - Configurable weights

4. **Better Error Handling**
   - Graceful Gemini API failures
   - Retry logic with exponential backoff

### 12.2 Medium Term (1 quarter)

1. **Advanced Analytics**
   - Predictive performance indicators
   - Early warning system integration
   - Peer comparison (anonymized)

2. **Parent Portal**
   - Secure parent access to student recap
   - Parent-teacher messaging
   - Progress notifications

3. **Mobile Optimization**
   - Responsive PDF export
   - Mobile-friendly UI
   - Offline capability

4. **Audit & Compliance**
   - Access logging
   - Data modification tracking
   - GDPR compliance features

### 12.3 Long Term (1+ year)

1. **AI Enhancements**
   - Multi-language support
   - Personalized recommendations
   - Predictive interventions

2. **Integration**
   - LMS integration
   - Parent communication platform
   - Student information system (SIS)

3. **Advanced Reporting**
   - Custom report builder
   - Data export (Excel, CSV)
   - Scheduled reports

---

## 13. Deployment Checklist

- [ ] Database migrations run
- [ ] Gemini API key configured
- [ ] Redis cache configured
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Error logging configured
- [ ] Backup strategy in place
- [ ] Performance monitoring enabled
- [ ] Security headers configured

---

## 14. Troubleshooting

### Issue: Narrative not generating
**Solution:** Check Gemini API key, verify API quota, check network connectivity

### Issue: PDF export fails
**Solution:** Check browser console for errors, verify html2canvas library loaded, check PDF size

### Issue: Slow data loading
**Solution:** Check database indexes, verify Redis cache working, check network latency

### Issue: Geolocation not working
**Solution:** Check browser permissions, verify HTTPS enabled, check Nominatim API availability

---

## 15. References

- **Frontend:** `resources/js/pages/RekapIndividuPage.jsx`
- **Backend:** `app/Http/Controllers/Api/StudentDashboardController.php`
- **Services:** `app/Services/GradeCalculationService.php`
- **Utilities:** `resources/js/utils/gemini.js`, `resources/js/utils/pdfGenerator.js`
- **Models:** `app/Models/Grade.php`, `app/Models/Attendance.php`, `app/Models/Infraction.php`

---

**Document Version:** 1.0  
**Last Reviewed:** 2026-05-24  
**Next Review:** 2026-08-24
