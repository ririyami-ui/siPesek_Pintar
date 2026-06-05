# ✅ DEPLOYMENT CHECKLIST - Smart School Backend

**Date:** May 24, 2026  
**Time:** 16:33 UTC  
**Status:** READY FOR DEPLOYMENT

---

## 📋 Pre-Deployment Checklist

### Code Review
- [ ] Review `BUG_FIX_ROMBEL_FILTER.md`
- [ ] Review `BUG_FIX_SUBJECT_DROPDOWN.md`
- [ ] Verify StudentController.php changes (baris 52-56)
- [ ] Verify SubjectController.php changes (baris 17-30)
- [ ] Check no syntax errors: `php artisan tinker`

### Testing
- [ ] Test rombel filter (pilih kelas 7A → hanya siswa 7A)
- [ ] Test subject dropdown admin (13 mapel muncul)
- [ ] Test subject dropdown guru (hanya mapel yang diampu)
- [ ] Test dengan berbagai kelas
- [ ] Verify tidak ada error di console

### Documentation
- [ ] Read MASTER_INDEX.md
- [ ] Read BUGS_FIXED_SUMMARY.md
- [ ] Understand both fixes
- [ ] Know testing procedures

---

## 🚀 Deployment Steps

### Step 1: Backup
```bash
# Backup current code
git stash
# atau
git commit -m "backup: before bug fixes"
```

### Step 2: Deploy Code
```bash
# Deploy StudentController.php
# Deploy SubjectController.php

# Verify files deployed correctly
ls -la app/Http/Controllers/StudentController.php
ls -la app/Http/Controllers/SubjectController.php
```

### Step 3: Clear Cache
```bash
php artisan cache:clear
php artisan config:clear
php artisan view:clear
```

### Step 4: Verify
```bash
# Check no syntax errors
php artisan tinker
# Type: exit

# Check application runs
php artisan serve
```

---

## 🧪 Post-Deployment Testing

### Test 1: Rombel Filter
```
1. Login sebagai admin/guru
2. Buka Rekap Individu
3. Pilih kelas "7A"
4. Lihat daftar siswa
✅ Expected: Hanya siswa dari 7A
```

### Test 2: Subject Dropdown (Admin)
```
1. Login sebagai admin
2. Buka Input Nilai
3. Lihat dropdown mata pelajaran
✅ Expected: 13 mapel muncul
```

### Test 3: Subject Dropdown (Guru)
```
1. Login sebagai guru
2. Buka Input Nilai
3. Lihat dropdown mata pelajaran
✅ Expected: Hanya mapel yang diampu
```

### Test 4: Multiple Classes
```
1. Login sebagai guru
2. Pilih kelas A → lihat mapel
3. Pilih kelas B → lihat mapel berbeda
✅ Expected: Mapel berubah sesuai kelas
```

---

## 📊 Monitoring

### Error Logs
```bash
# Watch error logs
tail -f storage/logs/laravel.log

# Search for errors
grep -i "error\|exception" storage/logs/laravel.log
```

### Database Queries
```bash
# Enable query logging in .env
APP_DEBUG=true

# Check queries in logs
grep "SELECT" storage/logs/laravel.log
```

### Performance
- Monitor response time: < 1 second
- Monitor database queries: < 10 per request
- Monitor memory usage: < 100MB

---

## ⚠️ Rollback Plan

### Jika Ada Error

**Option 1: Git Revert**
```bash
git revert <commit-hash>
git push
```

**Option 2: Manual Revert**
```php
// StudentController.php - revert to old code
elseif (request()->has('rombel')) {
    $query->where('class_id', request()->rombel);
}

// SubjectController.php - remove all=true check
// (remove lines 10-12)
```

**Option 3: Rollback Database**
```bash
# If database changes needed
php artisan migrate:rollback
```

---

## 📞 Support Contacts

**Jika ada masalah:**

1. **Rombel Filter Issue**
   - Baca: `BUG_FIX_ROMBEL_FILTER.md`
   - Check: StudentController.php baris 52-56
   - Test: Pilih kelas → lihat siswa

2. **Subject Dropdown Issue**
   - Baca: `BUG_FIX_SUBJECT_DROPDOWN.md`
   - Check: SubjectController.php baris 17-30
   - Test: Lihat dropdown mapel

3. **General Issues**
   - Baca: `MASTER_INDEX.md`
   - Baca: `BUGS_FIXED_SUMMARY.md`
   - Check: Error logs

---

## ✅ Sign-Off

### Deployment Approved By
- [ ] Developer: _________________ Date: _______
- [ ] QA Lead: _________________ Date: _______
- [ ] DevOps: _________________ Date: _______

### Deployment Completed By
- [ ] Deployed By: _________________ Date: _______
- [ ] Verified By: _________________ Date: _______

### Post-Deployment Verified By
- [ ] Tested By: _________________ Date: _______
- [ ] Approved By: _________________ Date: _______

---

## 📝 Deployment Notes

```
Deployment Date: _______________
Deployed By: _______________
Environment: [ ] Staging [ ] Production
Status: [ ] Success [ ] Failed [ ] Partial

Issues Found: _______________
Resolution: _______________

Notes: _______________
```

---

## 🎯 Success Criteria

✅ **All of these must be true:**

- [ ] Rombel filter works correctly
- [ ] Subject dropdown shows 13 mapel for admin
- [ ] Subject dropdown shows only assigned mapel for guru
- [ ] No errors in logs
- [ ] Response time < 1 second
- [ ] All tests pass
- [ ] Users report no issues

---

## 📚 Documentation Reference

| Document | Purpose |
|----------|---------|
| MASTER_INDEX.md | Start here - navigation guide |
| BUGS_FIXED_SUMMARY.md | Summary of both fixes |
| BUG_FIX_ROMBEL_FILTER.md | Rombel filter fix details |
| BUG_FIX_SUBJECT_DROPDOWN.md | Subject dropdown fix details |
| TESTING_GUIDE_ROMBEL_FIX.md | Testing procedures |
| audit.md | Security audit (reference) |

---

## 🎉 Ready to Deploy!

**Status:** ✅ ALL CHECKS PASSED

**Next Action:** Deploy to staging → Test → Deploy to production

---

**Deployment Checklist Version:** 1.0  
**Last Updated:** May 24, 2026 16:33 UTC  
**Status:** READY FOR USE
