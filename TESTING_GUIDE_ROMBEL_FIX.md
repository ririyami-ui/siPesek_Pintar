# Testing & Verification Guide - Rombel Filter Fix

**Date:** May 24, 2026  
**Component:** StudentController - Rombel Filter  
**Status:** Ready for Testing

---

## 1. Quick Summary of Changes

### What Was Fixed
```diff
- $query->where('class_id', request()->rombel);
+ $query->whereHas('class', function($q) {
+     $q->where('rombel', request()->rombel);
+ });
```

### Why It Matters
- **Before:** Selecting class "7A" showed students from wrong class
- **After:** Selecting class "7A" shows only students from class 7A

---

## 2. Manual Testing Steps

### Test Environment Setup
1. Access Rekap Individu page: `/rekap-individu`
2. Ensure you have multiple classes with students
3. Have browser DevTools open (F12) for debugging

### Test Case 1: Basic Class Selection

**Objective:** Verify correct students display for selected class

**Steps:**
1. Open Rekap Individu page
2. Click "Pilih Kelas" dropdown
3. Select "7A"
4. Wait for student list to load
5. Verify all displayed students belong to class 7A

**Expected Result:**
- ✅ Student list shows only 7A students
- ✅ Student count matches class roster
- ✅ No students from other classes appear

**How to Verify:**
- Check student NIS/NISN against class roster
- Count students and compare with database
- Look for any students with different class in their profile

---

### Test Case 2: Switch Between Classes

**Objective:** Verify student list updates when changing class

**Steps:**
1. Select class "7A" (observe student list)
2. Select class "8D" (observe student list changes)
3. Select class "9C" (observe student list changes)
4. Go back to "7A" (verify same students appear)

**Expected Result:**
- ✅ Student list updates immediately
- ✅ No duplicate students from previous selection
- ✅ Returning to same class shows same students

**How to Verify:**
- Note first 3 student names in 7A
- Switch to 8D and verify different names
- Switch back to 7A and verify original names return

---

### Test Case 3: Search Within Class

**Objective:** Verify search respects class filter

**Steps:**
1. Select class "7A"
2. Search for a student name (e.g., "Budi")
3. Verify only 7A students appear in results
4. Select class "8D"
5. Search for same name
6. Verify only 8D students appear

**Expected Result:**
- ✅ Search results filtered by selected class
- ✅ No cross-class data leakage
- ✅ Same student name in different classes shows correctly

---

### Test Case 4: Student Data Loading

**Objective:** Verify correct student data loads after selection

**Steps:**
1. Select class "7A"
2. Click on a student name
3. Observe student recap data loads
4. Verify:
   - Student name matches
   - Class shows "7A"
   - Grades are for this student
   - Attendance records are correct

**Expected Result:**
- ✅ All data belongs to selected student
- ✅ No data from other students appears
- ✅ Class field shows correct class

---

### Test Case 5: Empty Class Handling

**Objective:** Verify graceful handling of empty classes

**Steps:**
1. Create a test class with no students
2. Select that class in Rekap Individu
3. Observe empty state message

**Expected Result:**
- ✅ Shows "Tidak ada siswa" message
- ✅ No errors in console
- ✅ Can select other classes normally

---

## 3. Automated Testing (Recommended)

### Unit Test Example

```php
<?php

namespace Tests\Feature;

use App\Models\Student;
use App\Models\SchoolClass;
use Tests\TestCase;

class StudentControllerTest extends TestCase
{
    public function test_students_filtered_by_rombel()
    {
        // Create test classes
        $class7A = SchoolClass::factory()->create(['rombel' => '7A']);
        $class8D = SchoolClass::factory()->create(['rombel' => '8D']);
        
        // Create students in each class
        $students7A = Student::factory(5)->create(['class_id' => $class7A->id]);
        $students8D = Student::factory(3)->create(['class_id' => $class8D->id]);
        
        // Test filtering by rombel
        $response = $this->get('/api/students?rombel=7A');
        
        $response->assertStatus(200);
        $response->assertJsonCount(5, 'data');
        
        // Verify all returned students are from 7A
        foreach ($response->json('data') as $student) {
            $this->assertEquals($class7A->id, $student['class_id']);
        }
    }
    
    public function test_students_filtered_by_class_id()
    {
        $class = SchoolClass::factory()->create();
        $students = Student::factory(3)->create(['class_id' => $class->id]);
        
        $response = $this->get("/api/students?class_id={$class->id}");
        
        $response->assertStatus(200);
        $response->assertJsonCount(3, 'data');
    }
    
    public function test_no_cross_class_data_leakage()
    {
        $class7A = SchoolClass::factory()->create(['rombel' => '7A']);
        $class8D = SchoolClass::factory()->create(['rombel' => '8D']);
        
        $students7A = Student::factory(5)->create(['class_id' => $class7A->id]);
        $students8D = Student::factory(5)->create(['class_id' => $class8D->id]);
        
        // Get 7A students
        $response7A = $this->get('/api/students?rombel=7A');
        $ids7A = collect($response7A->json('data'))->pluck('id');
        
        // Get 8D students
        $response8D = $this->get('/api/students?rombel=8D');
        $ids8D = collect($response8D->json('data'))->pluck('id');
        
        // Verify no overlap
        $this->assertEmpty($ids7A->intersect($ids8D));
    }
}
```

### Run Tests

```bash
# Run specific test
php artisan test tests/Feature/StudentControllerTest.php

# Run with coverage
php artisan test --coverage

# Run specific test method
php artisan test tests/Feature/StudentControllerTest::test_students_filtered_by_rombel
```

---

## 4. Browser DevTools Debugging

### Check Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. Select class "7A"
4. Look for request to `/api/students`
5. Check request parameters:
   ```
   GET /api/students?rombel=7A
   ```
6. Check response:
   ```json
   {
     "data": [
       {
         "id": 1,
         "name": "Budi Santoso",
         "class_id": 1,
         "class": {
           "id": 1,
           "rombel": "7A"
         }
       }
     ]
   }
   ```

### Check Console for Errors

1. Open DevTools Console tab
2. Select different classes
3. Verify no errors appear
4. Look for any warnings about data mismatches

### Check Database Queries

Enable query logging in Laravel:

```php
// In .env
APP_DEBUG=true

// In config/logging.php or add to AppServiceProvider
DB::listen(function($query) {
    \Log::info($query->sql, $query->bindings);
});
```

Then check `storage/logs/laravel.log` for SQL queries:

```sql
-- Should see JOIN query like:
SELECT `students`.* FROM `students`
INNER JOIN `classes` ON `students`.`class_id` = `classes`.`id`
WHERE `classes`.`rombel` = '7A'
```

---

## 5. Performance Testing

### Load Test: Multiple Class Selections

**Objective:** Verify performance with large datasets

**Steps:**
1. Create 100+ students across multiple classes
2. Rapidly switch between classes
3. Monitor response times
4. Check for memory leaks

**Expected Result:**
- ✅ Response time < 500ms per request
- ✅ No memory leaks
- ✅ Smooth UI transitions

**Tools:**
```bash
# Use Apache Bench
ab -n 100 -c 10 "http://localhost:8000/api/students?rombel=7A"

# Use wrk
wrk -t4 -c100 -d30s "http://localhost:8000/api/students?rombel=7A"
```

---

## 6. Edge Cases to Test

### Edge Case 1: Special Characters in Rombel

**Test:** Class name with special characters (e.g., "7A-1", "7A/B")

```
GET /api/students?rombel=7A-1
GET /api/students?rombel=7A/B
```

**Expected:** Correct filtering with special characters

---

### Edge Case 2: Case Sensitivity

**Test:** Different case variations

```
GET /api/students?rombel=7a      (lowercase)
GET /api/students?rombel=7A      (uppercase)
GET /api/students?rombel=7A      (mixed)
```

**Expected:** Consistent results (case-insensitive or documented behavior)

---

### Edge Case 3: Non-existent Class

**Test:** Request with non-existent rombel

```
GET /api/students?rombel=99Z
```

**Expected:** Empty array with no errors

```json
{
  "data": []
}
```

---

### Edge Case 4: Missing Parameter

**Test:** Request without rombel or class_id

```
GET /api/students
```

**Expected:** Returns all students (or filtered by user role)

---

### Edge Case 5: Both Parameters Provided

**Test:** Request with both rombel and class_id

```
GET /api/students?rombel=7A&class_id=1
```

**Expected:** Documented behavior (which takes precedence?)

---

## 7. Regression Testing

### Check Other Features Still Work

1. **Grade Entry**
   - Select class → select student → enter grades
   - Verify grades saved correctly

2. **Attendance**
   - Select class → mark attendance
   - Verify attendance recorded for correct students

3. **Infractions**
   - Select class → record infraction
   - Verify infraction linked to correct student

4. **Narrative Generation**
   - Select student → generate narrative
   - Verify narrative uses correct student data

---

## 8. User Acceptance Testing (UAT)

### UAT Checklist

- [ ] Teacher can select their class
- [ ] Correct students display for selected class
- [ ] Can switch between classes smoothly
- [ ] Student data loads correctly
- [ ] Can generate student recap
- [ ] Can export PDF
- [ ] Can generate narrative
- [ ] No data from other classes appears
- [ ] Search works within class
- [ ] Performance is acceptable

### UAT Sign-off

```
Tested by: ________________
Date: ________________
Status: ☐ Pass  ☐ Fail
Comments: ________________
```

---

## 9. Deployment Verification

### Pre-Deployment Checklist

- [ ] Code reviewed and approved
- [ ] Tests pass locally
- [ ] No console errors
- [ ] Database queries optimized
- [ ] No breaking changes

### Post-Deployment Checklist

- [ ] Feature works in production
- [ ] No error logs
- [ ] Performance acceptable
- [ ] User feedback positive
- [ ] Monitor for issues

---

## 10. Rollback Plan

If issues occur after deployment:

### Quick Rollback

```bash
# Revert the change
git revert <commit-hash>

# Or manually revert to old code
# In StudentController.php line 52-54:
elseif (request()->has('rombel')) {
    $query->where('class_id', request()->rombel);
}
```

### Notify Users

- Inform users of temporary issue
- Provide workaround if available
- Provide ETA for fix

---

## 11. Monitoring & Alerts

### Set Up Monitoring

1. **Error Rate**
   - Alert if `/api/students` error rate > 1%

2. **Response Time**
   - Alert if response time > 1 second

3. **Database Queries**
   - Monitor JOIN query performance
   - Alert if slow queries detected

### Log Monitoring

```bash
# Watch logs in real-time
tail -f storage/logs/laravel.log | grep "students"

# Search for errors
grep -i "error\|exception" storage/logs/laravel.log
```

---

## 12. Documentation Updates

### Update API Documentation

```markdown
### GET /api/students

Filter students by class.

**Query Parameters:**
- `rombel` (string): Class name (e.g., "7A")
- `class_id` (integer): Class ID
- `search` (string): Student name/NIS/NISN

**Example:**
```
GET /api/students?rombel=7A
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Budi Santoso",
      "nis": "001",
      "nisn": "0001234567",
      "class_id": 1,
      "class": {
        "id": 1,
        "rombel": "7A"
      }
    }
  ]
}
```
```

---

## 13. Summary

### What Was Fixed
- Rombel filter now correctly joins with classes table
- Students display correctly for selected class
- No cross-class data leakage

### Testing Priority
1. **Critical:** Basic class selection (Test Case 1)
2. **High:** Switch between classes (Test Case 2)
3. **High:** Student data loading (Test Case 4)
4. **Medium:** Search within class (Test Case 3)
5. **Low:** Edge cases (Test Cases 5-7)

### Next Steps
1. Run manual tests (Section 2)
2. Run automated tests (Section 3)
3. Perform UAT (Section 8)
4. Deploy to production
5. Monitor for issues (Section 11)

---

**Testing Status:** Ready  
**Last Updated:** 2026-05-24  
**Next Review:** After deployment
