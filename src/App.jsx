import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Clock, CalendarRange, FileSpreadsheet, BadgeDollarSign,
  Plus, Trash2, Play, Building2, Search, Settings2, Printer, 
  Database, Briefcase, CreditCard, UserCircle, MapPin, X, Phone,
  Download, FileText, Eye, Image as ImageIcon, Edit, Filter,
  Mail, FileSignature, ShieldAlert, Store, ChevronDown, ChevronUp
} from 'lucide-react';
import LogoPerusahaan from './assets/logo-perusahaan.jpg'; 

// ==========================================
// URL GOOGLE APPS SCRIPT (API DATABASE)
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbyVAyByEQNq7RS2e1Lfs5duvx8MW4jXue-iG3L8R3uY4IBDEpiNHi39sGP5-oy2eqSKQA/exec";

const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0
  }).format(number);
};

const SALARY_TYPES = ['Harian', 'Mingguan', 'Bulanan'];
const BANKS = ['BCA', 'Mandiri', 'BNI', 'BRI', 'BSI', 'CIMB Niaga', 'DANA', 'ShopeePay', 'GoPay', 'OVO', 'LinkAja', 'Lainnya'];
const MARITAL_STATUSES = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];

const calculateTimeDifference = (targetTime, actualTime, type = 'late') => {
  if (!targetTime || !actualTime) return 0;
  const [tH, tM] = targetTime.split(':').map(Number);
  const [aH, aM] = actualTime.split(':').map(Number);
  const targetTotal = (tH * 60) + tM;
  const actualTotal = (aH * 60) + aM;
  if (type === 'late') return actualTotal > targetTotal ? (actualTotal - targetTotal) : 0;
  if (type === 'early') return actualTotal < targetTotal ? (targetTotal - actualTotal) : 0;
  if (type === 'overtime') return actualTotal > targetTotal ? (actualTotal - targetTotal) : 0;
  return 0;
};

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

// HELPER TANGGAL
const getFormattedDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayDate = new Date();
const todayStr = getFormattedDate(todayDate);
const sevenDaysAgoDate = new Date();
sevenDaysAgoDate.setDate(todayDate.getDate() - 7);
const sevenDaysAgoStr = getFormattedDate(sevenDaysAgoDate);

const initialEmpForm = { 
  id: '', nik: '', npwp: '', name: '', email: '', 
  addressDetail: '', village: '', district: '', city: '', province: '', country: 'Indonesia',
  branch: 'BR-HO', department: '', position: '', phone: '', maritalStatus: 'Belum Kawin',
  bankName: 'BCA', bankAccount: '', salaryType: 'Harian', baseSalary: '', dailyBonus: '', status: 'Aktif',
  countOvertime: 'Tidak', overtimeThreshold: '0', overtimeRate: '',
  lateTolerance: '0', latePenaltyRate: '', earlyPenaltyRate: '',
  photo: '', ktpPhoto: ''
};

export default function HRDashboard() {
  const [activeTab, setActiveTab] = useState('absensi'); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [globalBranchFilter, setGlobalBranchFilter] = useState(''); 
  const [isSyncing, setIsSyncing] = useState(false);
  
  // ================= STATE MANAGEMENT DENGAN SANITASI DATA =================
  const [branches, setBranches] = useState(() => {
    const saved = localStorage.getItem('hr_branches');
    return saved ? JSON.parse(saved) : [];
  });
  const [departments, setDepartments] = useState(() => {
    const saved = localStorage.getItem('hr_departments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Paksa ubah string "TRUE" / "FALSE" dari sheets ke boolean asli
        return parsed.map(d => ({...d, saturdayHalfDay: d.saturdayHalfDay === true || String(d.saturdayHalfDay).toUpperCase() === 'TRUE'}));
      } catch(e) { return []; }
    }
    return [];
  });
  const [masterShifts, setMasterShifts] = useState(() => {
    const saved = localStorage.getItem('hr_masterShifts');
    return saved ? JSON.parse(saved) : [];
  });
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('hr_employees');
    return saved ? JSON.parse(saved) : [];
  });
  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('hr_schedules');
    return saved ? JSON.parse(saved) : [];
  });
  const [attendances, setAttendances] = useState(() => {
    const saved = localStorage.getItem('hr_attendances');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Paksa ubah string "TRUE" / "FALSE" dari sheets ke boolean asli agar tidak error "Hari Libur"
        return parsed.map(a => ({...a, isLibur: a.isLibur === true || String(a.isLibur).toUpperCase() === 'TRUE'}));
      } catch(e) { return []; }
    }
    return [];
  });

  useEffect(() => {
    const fetchAPI = async () => {
      setIsSyncing(true);
      try {
        const fetchSheet = async (sheet, storageKey, setter) => {
          try {
            const res = await fetch(`${API_URL}?action=get&sheet=${sheet}`);
            const data = await res.json();
            if (Array.isArray(data)) {
              let sanitizedData = data;
              // Filter keamanan tambahan agar string boolean terkonversi dengan benar
              if (sheet === 'attendances') {
                sanitizedData = data.map(a => ({...a, isLibur: a.isLibur === true || String(a.isLibur).toUpperCase() === 'TRUE'}));
              }
              if (sheet === 'departments') {
                sanitizedData = data.map(d => ({...d, saturdayHalfDay: d.saturdayHalfDay === true || String(d.saturdayHalfDay).toUpperCase() === 'TRUE'}));
              }
              setter(sanitizedData);
              localStorage.setItem(storageKey, JSON.stringify(sanitizedData));
            }
          } catch (e) {
            console.warn(`Gagal memuat ${sheet}`, e);
          }
        };

        await Promise.all([
          fetchSheet('employees', 'hr_employees', setEmployees),
          fetchSheet('branches', 'hr_branches', setBranches),
          fetchSheet('departments', 'hr_departments', setDepartments),
          fetchSheet('masterShifts', 'hr_masterShifts', setMasterShifts),
          fetchSheet('schedules', 'hr_schedules', setSchedules),
          fetchSheet('attendances', 'hr_attendances', setAttendances)
        ]);
      } finally {
        setIsSyncing(false);
      }
    };
    fetchAPI();
  }, []);

  const updateStateAndSync = (sheetName, newData, setFunction, storageKey) => {
    setFunction(newData);
    localStorage.setItem(storageKey, JSON.stringify(newData));
    setIsSyncing(true);
    
    fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ sheetName: sheetName, data: newData })
    }).then(() => setIsSyncing(false)).catch(() => setIsSyncing(false));
  };

  const updateBranches = (data) => updateStateAndSync('branches', data, setBranches, 'hr_branches');
  const updateDepartments = (data) => updateStateAndSync('departments', data, setDepartments, 'hr_departments');
  const updateMasterShifts = (data) => updateStateAndSync('masterShifts', data, setMasterShifts, 'hr_masterShifts');
  const updateEmployees = (data) => updateStateAndSync('employees', data, setEmployees, 'hr_employees');
  const updateSchedules = (data) => updateStateAndSync('schedules', data, setSchedules, 'hr_schedules');
  const updateAttendances = (data) => updateStateAndSync('attendances', data, setAttendances, 'hr_attendances');

  // ================= FORM & MODAL STATES =================
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false); 
  const [selectedEmployee, setSelectedEmployee] = useState(null); 
  
  const [empForm, setEmpForm] = useState(initialEmpForm);
  const [branchForm, setBranchForm] = useState({ id: '', name: '' });
  const [deptForm, setDeptForm] = useState({ id: '', name: '', saturdayHalfDay: false });
  const [shiftForm, setShiftForm] = useState({ id: '', name: '', timeIn: '08:30', timeOut: '17:00' });
  
  const [scheduleAssignType, setScheduleAssignType] = useState('department'); 
  const [scheduleForm, setScheduleForm] = useState({ targetId: '', shiftId: '', startDate: '', endDate: '' });
  const [expandedEmpId, setExpandedEmpId] = useState(null);
  
  const [csvData, setCsvData] = useState('');
  const [importLogs, setImportLogs] = useState([]);
  
  const [attStartDate, setAttStartDate] = useState(sevenDaysAgoStr); 
  const [attEndDate, setAttEndDate] = useState(todayStr); 
  const [attFilterDept, setAttFilterDept] = useState('');
  const [attSearchTerm, setAttSearchTerm] = useState('');
  
  const [payrollSearchTerm, setPayrollSearchTerm] = useState('');
  const [payrollFilterDept, setPayrollFilterDept] = useState('');
  const [payrollPeriod, setPayrollPeriod] = useState({ startDate: '2026-10-01', endDate: '2026-10-31' });
  const [additionalIncomes, setAdditionalIncomes] = useState({}); 
  const [customDeductions, setCustomDeductions] = useState({});   
  const [printData, setPrintData] = useState(null);
  const [printType, setPrintType] = useState('slip'); 

  const getFullAddress = (emp) => {
    if (emp.addressDetail || emp.city) {
      return `${emp.addressDetail || ''}, Ds. ${emp.village || '-'}, Kec. ${emp.district || '-'}, ${emp.city || '-'}, ${emp.province || '-'}, ${emp.country || 'Indonesia'}`.replace(/^,\s*/, '');
    }
    return emp.address || '-'; 
  };

  const handleAddBranch = (e) => {
    e.preventDefault();
    updateBranches([...branches, branchForm]);
    setBranchForm({ id: '', name: '' });
  };
  const handleAddDept = (e) => {
    e.preventDefault();
    updateDepartments([...departments, deptForm]);
    setDeptForm({ id: '', name: '', saturdayHalfDay: false });
  };
  const handleAddShift = (e) => {
    e.preventDefault();
    updateMasterShifts([...masterShifts, shiftForm]);
    setShiftForm({ id: '', name: '', timeIn: '08:30', timeOut: '17:00' });
  };
  const deleteItem = (updater, state, id, key = 'id') => {
    if(window.confirm('Yakin ingin menghapus data ini? Aksi ini akan menghapusnya juga dari Google Sheets.')) { 
      updater(state.filter(item => item[key] !== id)); 
    }
  };

  const handleOpenAddForm = () => {
    setEmpForm(initialEmpForm);
    setIsEditing(false);
    setShowEmpForm(true);
  };

  const handleEditClick = (emp) => {
    setEmpForm({ ...initialEmpForm, ...emp }); 
    setIsEditing(true);
    setShowEmpForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleSaveEmployee = (e) => {
    e.preventDefault();
    const parsedBaseSalary = parseFloat(empForm.baseSalary) || 0;
    const parsedDailyBonus = parseFloat(empForm.dailyBonus) || 0;
    const parsedOvertimeRate = parseFloat(empForm.overtimeRate) || 0;
    const parsedLatePenaltyRate = parseFloat(empForm.latePenaltyRate) || 0;
    const parsedEarlyPenaltyRate = parseFloat(empForm.earlyPenaltyRate) || 0;

    const finalEmpData = { 
      ...empForm, 
      baseSalary: parsedBaseSalary, dailyBonus: parsedDailyBonus,
      overtimeRate: parsedOvertimeRate, latePenaltyRate: parsedLatePenaltyRate, earlyPenaltyRate: parsedEarlyPenaltyRate
    };

    if (isEditing) {
      updateEmployees(employees.map(emp => emp.id === empForm.id ? finalEmpData : emp));
    } else {
      if (employees.some(emp => emp.id === empForm.id)) {
        alert('ID Karyawan sudah digunakan! Silakan gunakan ID lain.');
        return;
      }
      updateEmployees([...employees, finalEmpData]);
    }
    
    setShowEmpForm(false);
    setIsEditing(false);
    setEmpForm(initialEmpForm);
  };

  const handleAddSchedule = (e) => {
    e.preventDefault();
    if (scheduleAssignType === 'department') {
      const deptEmps = employees.filter(emp => 
        emp.department === scheduleForm.targetId && 
        (globalBranchFilter === '' || emp.branch === globalBranchFilter) &&
        (emp.status === undefined || emp.status === null || String(emp.status).toLowerCase() === 'aktif')
      );
      if(deptEmps.length === 0) { alert('Tidak ada karyawan aktif di departemen/cabang ini!'); return; }
      const newSchedules = deptEmps.map((emp, idx) => ({
        id: Date.now() + idx, empId: emp.id, shiftId: scheduleForm.shiftId, startDate: scheduleForm.startDate, endDate: scheduleForm.endDate
      }));
      updateSchedules([...schedules, ...newSchedules]);
      alert(`Berhasil membuat jadwal untuk ${deptEmps.length} karyawan dan mensinkronkannya!`);
    } else {
      updateSchedules([...schedules, { id: Date.now().toString(), empId: scheduleForm.targetId, shiftId: scheduleForm.shiftId, startDate: scheduleForm.startDate, endDate: scheduleForm.endDate }]);
      alert('Jadwal berhasil ditambahkan!');
    }
    setScheduleForm({ targetId: '', shiftId: '', startDate: '', endDate: '' });
  };

  const baseFilteredEmployees = useMemo(() => {
    return employees.filter(emp => globalBranchFilter ? emp.branch === globalBranchFilter : true);
  }, [employees, globalBranchFilter]);

  const handleExportCSV = () => {
    const headers = "ID_KARYAWAN,NIK,NPWP,NAMA,EMAIL,CABANG,DEPARTEMEN,JABATAN,NO_HP,ALAMAT_LENGKAP,BANK,NO_REKENING,SKEMA_GAJI,GAJI_POKOK,STATUS\n";
    const rows = baseFilteredEmployees.map(e => {
        const branchName = branches.find(b => b.id === e.branch)?.name || 'Head Office';
        const deptName = departments.find(d => d.id === e.department)?.name || '-';
        const addressStr = getFullAddress(e).replace(/,/g, '');
        return `${e.id},'${e.nik || ''},'${e.npwp || ''},${e.name},${e.email || ''},${branchName},${deptName},${e.position || ''},'${e.phone || ''},"${addressStr}",${e.bankName || ''},'${e.bankAccount || ''},${e.salaryType},${e.baseSalary},${e.status || 'Aktif'}`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Data_Karyawan_${globalBranchFilter || 'Semua_Cabang'}.csv`;
    a.click();
  };

  const handlePrintKaryawanPDF = () => {
    setPrintType('pegawai');
    setPrintData(baseFilteredEmployees);
    setTimeout(() => window.print(), 200);
  };

  const processImport = () => {
    if(!csvData.trim()) { alert("Kotak teks masih kosong! Silakan Paste data CSV Anda terlebih dahulu."); return; }
    const lines = csvData.trim().split('\n');
    const logs = []; const newAttendances = [];
    let startIndex = lines[0].toUpperCase().includes('KARYAWAN') || lines[0].toUpperCase().includes('ID_') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      let line = lines[i].trim(); if (!line) continue;
      line = line.replace(/["“”']/g, ''); 
      const parts = line.split(/[\s\t,;]+/);
      if (parts.length < 3) continue;

      const empId = parts[0]; const dateRaw = parts[1];
      const scanIn = parts[2]; const scanOut = parts[3] || ''; 
      
      // PARSER TANGGAL YANG LEBIH ROBUST (Tahan banting format YYYY-MM-DD maupun DD/MM/YYYY)
      let y, m, d;
      if (dateRaw.includes('/')) {
         const p = dateRaw.split('/');
         if (p[2].length === 4) { d = p[0]; m = p[1]; y = p[2]; } 
         else { y = p[0]; m = p[1]; d = p[2]; } 
      } else if (dateRaw.includes('-')) {
         const p = dateRaw.split('-');
         if (p[2].length === 4) { d = p[0]; m = p[1]; y = p[2]; } 
         else { y = p[0]; m = p[1]; d = p[2]; } 
      } else {
         y = dateRaw.substring(0,4); m = dateRaw.substring(4,6); d = dateRaw.substring(6,8);
      }

      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
      const dayOfWeek = dateObj.getDay(); 

      const employee = employees.find(e => e.id === empId);
      if (!employee) { logs.push({ type: 'error', row: i+1, msg: `Pegawai ID '${empId}' tidak ditemukan.` }); continue; }
      
      if (globalBranchFilter && employee.branch !== globalBranchFilter) {
        logs.push({ type: 'error', row: i+1, msg: `Pegawai ID '${empId}' tidak terdaftar di cabang yang dipilih.` }); continue; 
      }

      const schedule = schedules.find(s => s.empId === empId && date >= s.startDate && date <= s.endDate);
      if (!schedule) { logs.push({ type: 'error', row: i+1, msg: `Jadwal shift '${employee.name}' tgl ${dateRaw} belum ada.` }); continue; }
      
      const shiftMaster = masterShifts.find(ms => ms.id === schedule.shiftId);
      const dept = departments.find(dp => dp.id === employee.department);
      
      // LOGIKA PENENTUAN SABTU SETENGAH HARI BERDASARKAN DIVISI
      const isHalfDaySat = dept && (dept.saturdayHalfDay === true || String(dept.saturdayHalfDay).toUpperCase() === 'TRUE');

      let targetTimeIn = shiftMaster.timeIn; let targetTimeOut = shiftMaster.timeOut; 
      let shiftNameDisplay = shiftMaster.name; let isLibur = false;

      // Logika Penentuan Hari Libur & Aturan Sabtu
      if (dayOfWeek === 0) { 
          isLibur = true; 
          shiftNameDisplay = 'Lembur (Minggu)'; 
      } 
      else if (dayOfWeek === 6) { 
          shiftNameDisplay = `${shiftMaster.name} (Sabtu)`; 
          if (isHalfDaySat) {
              targetTimeOut = '15:00'; 
              shiftNameDisplay += ' - Pulang 15:00';
          }
      }

      let lateMinutes = 0; let earlyMinutes = 0; let rawOvertimeMinutes = 0;
      if (!isLibur) {
        lateMinutes = calculateTimeDifference(targetTimeIn, scanIn, 'late');
        if (scanOut) {
          earlyMinutes = calculateTimeDifference(targetTimeOut, scanOut, 'early');
          rawOvertimeMinutes = calculateTimeDifference(targetTimeOut, scanOut, 'overtime');
        }
      }

      // Pastikan isLibur disimpan murni sebagai boolean standar Javascript
      newAttendances.push({ id: Date.now().toString() + i, empId, date, scanIn, scanOut, shiftName: shiftNameDisplay, lateMinutes, earlyMinutes, rawOvertimeMinutes, isLibur: isLibur });
      logs.push({ type: 'success', row: i+1, msg: `Sukses import absen '${employee.name}' tgl ${dateRaw} (${shiftNameDisplay}).` });
    }

    const filteredOld = attendances.filter(oldAtt => !newAttendances.some(newAtt => newAtt.empId === oldAtt.empId && newAtt.date === oldAtt.date));
    updateAttendances([...filteredOld, ...newAttendances]);
    setImportLogs(logs);
    if(newAttendances.length > 0) { setCsvData(''); }
  };

  const handleClearAllAttendance = () => {
    if(window.confirm("AWAS! Anda yakin ingin menghapus SEMUA riwayat absensi secara permanen dari Cloud?")) {
      updateAttendances([]); 
      setImportLogs([{ type: 'success', row: '-', msg: 'Semua riwayat absensi berhasil dibersihkan dari database Cloud.' }]);
    }
  };

  const handleUpdateExtra = (empId, index, field, value, type) => {
    const targetState = type === 'income' ? additionalIncomes : customDeductions;
    const targetSetter = type === 'income' ? setAdditionalIncomes : setCustomDeductions;
    const current = [...(targetState[empId] || [])]; current[index][field] = value; targetSetter({ ...targetState, [empId]: current });
  };
  const handleAddExtra = (empId, type) => {
    const targetState = type === 'income' ? additionalIncomes : customDeductions;
    const targetSetter = type === 'income' ? setAdditionalIncomes : setCustomDeductions;
    targetSetter({ ...targetState, [empId]: [...(targetState[empId] || []), { desc: '', amount: '' }] });
  };
  const handleRemoveExtra = (empId, index, type) => {
    const targetState = type === 'income' ? additionalIncomes : customDeductions;
    const targetSetter = type === 'income' ? setAdditionalIncomes : setCustomDeductions;
    const current = [...(targetState[empId] || [])]; current.splice(index, 1); targetSetter({ ...targetState, [empId]: current });
  };

  const filteredEmployees = useMemo(() => {
    return baseFilteredEmployees.filter(emp => {
      const safeName = String(emp.name || '').toLowerCase();
      const safeNik = String(emp.nik || '').toLowerCase();
      const safeId = String(emp.id || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      return safeName.includes(term) || safeNik.includes(term) || safeId.includes(term);
    });
  }, [baseFilteredEmployees, searchTerm]);

  const displayAttendances = useMemo(() => {
    return attendances
      .filter(att => {
        const emp = employees.find(e => e.id === att.empId);
        if (!emp) return false;
        
        if (globalBranchFilter && emp.branch !== globalBranchFilter) return false;
        if (attFilterDept && emp.department !== attFilterDept) return false;

        const matchStartDate = attStartDate ? att.date >= attStartDate : true;
        const matchEndDate = attEndDate ? att.date <= attEndDate : true;
        const matchDate = matchStartDate && matchEndDate;

        const searchLower = attSearchTerm.toLowerCase();
        const empName = String(emp.name || '').toLowerCase(); 
        const matchSearch = empName.includes(searchLower) || String(att.empId || '').toLowerCase().includes(searchLower);
        
        return matchDate && matchSearch;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendances, employees, attStartDate, attEndDate, attFilterDept, attSearchTerm, globalBranchFilter]);

  const payrollData = useMemo(() => {
    const filteredAttendance = attendances.filter(a => a.date >= payrollPeriod.startDate && a.date <= payrollPeriod.endDate);
    
    return baseFilteredEmployees.map(emp => {
      const empAtt = filteredAttendance.filter(a => a.empId === emp.id);
      const totalDays = empAtt.length;
      
      let totalLateMinutes = 0; let totalPenalizedLateMinutes = 0;
      let totalEarlyMinutes = 0; let totalPaidOvertimeMinutes = 0;

      const lateToleranceThreshold = Number(emp.lateTolerance) || 0;
      const overtimeThreshold = Number(emp.overtimeThreshold) || 0;
      const isCountOvertime = emp.countOvertime === 'Ya';

      empAtt.forEach(att => {
        // Hanya baca jika secara absolut boolean true
        const isTrueHoliday = att.isLibur === true;

        if (!isTrueHoliday) {
          totalLateMinutes += (att.lateMinutes || 0); totalEarlyMinutes += (att.earlyMinutes || 0);
          if (att.lateMinutes && att.lateMinutes > lateToleranceThreshold) { totalPenalizedLateMinutes += att.lateMinutes; }
          if (isCountOvertime && att.rawOvertimeMinutes && att.rawOvertimeMinutes >= overtimeThreshold) { totalPaidOvertimeMinutes += att.rawOvertimeMinutes; }
        } else {
          if (isCountOvertime && att.rawOvertimeMinutes) { totalPaidOvertimeMinutes += att.rawOvertimeMinutes; }
        }
      });
      
      let calculatedBaseSalary = emp.salaryType === 'Harian' ? emp.baseSalary * totalDays : emp.baseSalary;
      const totalBonus = emp.dailyBonus * totalDays;

      const latePenalty = totalPenalizedLateMinutes * (Number(emp.latePenaltyRate) || 0);
      const earlyPenalty = totalEarlyMinutes * (Number(emp.earlyPenaltyRate) || 0);
      const overtimePay = totalPaidOvertimeMinutes * (Number(emp.overtimeRate) || 0);

      const empIncomes = additionalIncomes[emp.id] || [];
      const totalAdditionalIncome = empIncomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const empDeductions = customDeductions[emp.id] || [];
      const totalOtherDeductions = empDeductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      const totalIncome = calculatedBaseSalary + totalBonus + overtimePay + totalAdditionalIncome;
      const totalDeduction = latePenalty + earlyPenalty + totalOtherDeductions;
      
      return { 
        ...emp, totalDays, calculatedBaseSalary, totalBonus, overtimePay,
        totalLateMinutes, totalEarlyMinutes, totalPenalizedLateMinutes, totalPaidOvertimeMinutes,
        latePenalty, earlyPenalty, empIncomes, empDeductions, totalIncome, totalDeduction, netSalary: totalIncome - totalDeduction 
      };
    });
  }, [baseFilteredEmployees, attendances, payrollPeriod, additionalIncomes, customDeductions]);

  const displayPayrollData = useMemo(() => {
    return payrollData.filter(data => {
      const safeName = String(data.name || '').toLowerCase();
      const safeId = String(data.id || '').toLowerCase();
      const searchLower = payrollSearchTerm.toLowerCase();
      
      const matchName = safeName.includes(searchLower) || safeId.includes(searchLower);
      const matchDept = payrollFilterDept ? data.department === payrollFilterDept : true;
      return matchName && matchDept;
    });
  }, [payrollData, payrollSearchTerm, payrollFilterDept]);


  const menuItems = [
    { id: 'pegawai', icon: <Database size={20}/>, label: 'Database Pegawai' },
    { id: 'master', icon: <Briefcase size={20}/>, label: 'Pengaturan Cabang, Shift & Dept' },
    { id: 'jadwal_shift', icon: <CalendarRange size={20}/>, label: 'Jadwal Shift' },
    { id: 'absensi', icon: <FileSpreadsheet size={20}/>, label: 'Absensi & Import' },
    { id: 'penggajian', icon: <BadgeDollarSign size={20}/>, label: 'Penggajian & Slip' },
  ];

  return (
    <>
      <div className="flex h-screen bg-[#F3F4F6] font-sans text-slate-800 overflow-hidden print:hidden">
        
        {/* SIDEBAR */}
        <aside className="w-72 bg-[#047857] text-slate-100 flex flex-col shadow-xl z-20">
          <div className="h-20 flex items-center px-6 border-b border-white/20 bg-[#065f46]">
            <img src={LogoPerusahaan} alt="Logo" className="h-10 w-10 mr-3 rounded-full object-cover border-2 border-[#B28E25] shadow-lg" />
            <div>
              <h1 className="text-[13px] font-extrabold text-white tracking-wide uppercase leading-tight">HR PT. Harvestama</h1>
              <p className="text-[10px] text-yellow-300 font-bold tracking-widest uppercase">Biota Alam</p>
            </div>
          </div>
          <div className="px-6 py-6 flex-1 overflow-y-auto">
            <p className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-widest mb-4 px-2">Menu Navigasi</p>
            <nav className="space-y-2">
              {menuItems.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-start px-4 py-3.5 rounded-xl transition-all duration-200 text-left ${activeTab === tab.id ? 'bg-[#B28E25] text-white shadow-lg shadow-yellow-900/30' : 'hover:bg-[#065f46] hover:text-white text-emerald-50'}`}>
                  <span className="mr-3 mt-0.5">{tab.icon}</span><span className="font-semibold text-[14px] tracking-wide leading-tight">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* HEADER */}
          <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-10 shadow-sm z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center text-gray-500 bg-gray-100 px-4 py-2.5 rounded-lg w-[320px] focus-within:bg-white transition-all border border-transparent focus-within:border-[#047857] shadow-inner">
                <Search className="mr-2 text-[#047857]" size={18}/>
                <input type="text" placeholder="Cari Karyawan..." className="bg-transparent border-none outline-none text-sm w-full" value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setActiveTab('pegawai');}} />
              </div>
              
              <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-100 transition-colors shadow-sm">
                <MapPin className="text-[#047857] mr-2" size={18}/>
                <select 
                  className="bg-transparent text-sm font-bold text-[#047857] outline-none cursor-pointer pr-4" 
                  value={globalBranchFilter} 
                  onChange={e => setGlobalBranchFilter(e.target.value)}
                  title="Filter Seluruh Aplikasi Berdasarkan Cabang"
                >
                  <option value="">🏢 Tampilkan Semua Cabang</option>
                  {branches.map(b => <option key={b.id} value={b.id}>📍 {b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 pl-5 border-l border-gray-200">
              {/* INDIKATOR STATUS CLOUD */}
              <div className="text-[10px] font-bold mr-2 bg-gray-100 px-3 py-1.5 rounded-full flex items-center border border-gray-200 shadow-inner">
                {isSyncing ? <span className="text-blue-600 animate-pulse">🔄 Menyinkronkan...</span> : <span className="text-emerald-600">☁️ Tersimpan di Cloud</span>}
              </div>

              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#047857] to-[#B28E25] flex items-center justify-center text-white font-bold text-sm shadow-md">AD</div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-800 leading-tight">Admin HRD</span>
                <span className="text-[11px] text-[#B28E25] font-bold max-w-[120px] truncate">{globalBranchFilter ? branches.find(b => b.id === globalBranchFilter)?.name : 'Semua Cabang (Global)'}</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-10 bg-[#f8fafc]">
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-[#047857] capitalize flex items-center">{menuItems.find(m => m.id === activeTab)?.icon}<span className="ml-3">{menuItems.find(m => m.id === activeTab)?.label}</span></h2>
                <p className="text-gray-500 text-sm mt-2">Sistem Informasi Manajemen Sumber Daya Manusia (HRIS).</p>
              </div>
              
              <div className="flex gap-3">
                {activeTab === 'pegawai' && !showEmpForm && (
                  <>
                    <button onClick={handleExportCSV} className="bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center hover:bg-emerald-200 transition-colors border border-emerald-200"><FileSpreadsheet className="mr-2" size={18}/> Excel (CSV)</button>
                    <button onClick={handlePrintKaryawanPDF} className="bg-rose-100 text-rose-700 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center hover:bg-rose-200 transition-colors border border-rose-200"><FileText className="mr-2" size={18}/> Cetak PDF</button>
                    <button onClick={handleOpenAddForm} className="bg-[#047857] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center shadow-lg hover:bg-[#065f46] transition-colors"><Plus className="mr-2" size={18}/> Tambah Karyawan Baru</button>
                  </>
                )}
                {activeTab === 'penggajian' && (
                  <button onClick={() => {setPrintType('slip'); setPrintData(displayPayrollData); setTimeout(() => window.print(), 200);}} className="bg-[#B28E25] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center shadow-md hover:bg-[#8f711b] transition-colors"><Printer className="mr-2" size={18}/> Cetak Slip Gaji (A4)</button>
                )}
              </div>
            </div>

            {/* TAB DATABASE PEGAWAI */}
            {activeTab === 'pegawai' && (
              <div className="space-y-6">
                
                {/* Form Registrasi / Edit Karyawan Lengkap */}
                {showEmpForm && (
                  <div className="bg-white p-8 rounded-2xl border border-emerald-100 shadow-xl relative animate-in fade-in slide-in-from-bottom-4">
                    <button onClick={() => setShowEmpForm(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500"><X size={24}/></button>
                    <h3 className="text-xl font-extrabold text-[#047857] mb-6 border-b border-gray-100 pb-4 flex items-center">
                      <UserCircle className="mr-2 text-[#B28E25]"/> 
                      {isEditing ? 'Update Data Karyawan' : 'Registrasi Karyawan Baru'}
                    </h3>
                    
                    <form onSubmit={handleSaveEmployee} className="space-y-8">
                      <div>
                        <h4 className="text-sm font-bold text-white mb-4 bg-[#B28E25] p-2 rounded-lg inline-block px-4 shadow-sm">A. Data Pribadi & Identitas</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nomor Induk Kependudukan (NIK KTP)</label><input required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.nik} onChange={e=>setEmpForm({...empForm, nik: e.target.value})} placeholder="16 digit NIK" /></div>
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nama Lengkap Sesuai KTP</label><input required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.name} onChange={e=>setEmpForm({...empForm, name: e.target.value})} /></div>
                          
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nomor NPWP (Opsional)</label><input className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.npwp} onChange={e=>setEmpForm({...empForm, npwp: e.target.value})} placeholder="Nomor NPWP Karyawan" /></div>
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Alamat Email Karyawan</label><input type="email" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.email} onChange={e=>setEmpForm({...empForm, email: e.target.value})} placeholder="email@contoh.com" /></div>

                          {/* MENU UPLOAD FOTO PROFIL & KTP */}
                          <div className="md:col-span-4 mt-2 mb-1"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-1">Upload Dokumen & Foto</span></div>
                          <div className="md:col-span-2">
                            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Upload Foto Profil Karyawan</label>
                            <input 
                              type="file" accept="image/*" 
                              className="w-full text-[11px] text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-emerald-50 file:text-[#047857] hover:file:bg-emerald-100 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setEmpForm({...empForm, photo: reader.result});
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Upload Scan / Foto KTP</label>
                            <input 
                              type="file" accept="image/*" 
                              className="w-full text-[11px] text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#B28E25]/10 file:text-[#B28E25] hover:file:bg-[#B28E25]/20 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setEmpForm({...empForm, ktpPhoto: reader.result});
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                          
                          <div className="md:col-span-4 mt-2 mb-1"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b pb-1">Rincian Alamat Domisili</span></div>
                          <div className="md:col-span-2"><label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Jalan / Detail Lokasi</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.addressDetail} onChange={e=>setEmpForm({...empForm, addressDetail: e.target.value})} placeholder="Jl. Mawar No.10, RT/RW..." /></div>
                          <div className="md:col-span-1"><label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Desa / Kelurahan</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.village} onChange={e=>setEmpForm({...empForm, village: e.target.value})} /></div>
                          <div className="md:col-span-1"><label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Kecamatan</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.district} onChange={e=>setEmpForm({...empForm, district: e.target.value})} /></div>
                          <div className="md:col-span-1"><label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Kota / Kabupaten</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.city} onChange={e=>setEmpForm({...empForm, city: e.target.value})} /></div>
                          <div className="md:col-span-1"><label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Provinsi</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.province} onChange={e=>setEmpForm({...empForm, province: e.target.value})} /></div>
                          <div className="md:col-span-2"><label className="text-[11px] font-semibold text-gray-500 mb-1.5 block">Negara</label><input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:border-[#047857] outline-none" value={empForm.country} onChange={e=>setEmpForm({...empForm, country: e.target.value})} /></div>

                          <div><label className="text-xs font-semibold text-gray-600 mb-1.5 block mt-2">Status Perkawinan</label><select required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-[#047857]" value={empForm.maritalStatus} onChange={e=>setEmpForm({...empForm, maritalStatus: e.target.value})}>{MARITAL_STATUSES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block mt-2">Nomor HP / WhatsApp Aktif</label><input required type="tel" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-[#047857] outline-none" value={empForm.phone} onChange={e=>setEmpForm({...empForm, phone: e.target.value})} /></div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white mb-4 bg-[#B28E25] p-2 rounded-lg inline-block px-4 shadow-sm">B. Data Penempatan & Pekerjaan</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">ID Karyawan (NIP)</label>
                            <input required disabled={isEditing} className={`w-full px-4 py-2.5 rounded-lg text-sm font-bold outline-none ${isEditing ? 'bg-gray-100 border border-gray-300 text-gray-500 cursor-not-allowed' : 'border border-[#047857]/50 bg-emerald-50 text-[#047857]'}`} value={empForm.id} onChange={e=>setEmpForm({...empForm, id: e.target.value})} />
                          </div>
                          
                          <div><label className="text-xs font-bold text-[#047857] mb-1.5 block flex items-center"><MapPin className="mr-1" size={14}/> Cabang Penempatan</label><select required className="w-full px-4 py-2.5 border-2 border-emerald-300 rounded-lg text-sm bg-emerald-50 outline-none focus:border-[#047857] font-bold text-[#047857]" value={empForm.branch} onChange={e=>setEmpForm({...empForm, branch: e.target.value})}><option value="">-- Pilih Cabang --</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                          
                          <div><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Departemen</label><select required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-[#047857]" value={empForm.department} onChange={e=>setEmpForm({...empForm, department: e.target.value})}><option value="">-- Pilih Departemen --</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                          <div><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Posisi / Jabatan</label><input required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={empForm.position} onChange={e=>setEmpForm({...empForm, position: e.target.value})} placeholder="Contoh: Staff" /></div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white mb-4 bg-[#B28E25] p-2 rounded-lg inline-block px-4 shadow-sm">C. Data Penggajian Dasar</h4>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                          <div><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Bank / E-Wallet</label><select required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-[#047857]" value={empForm.bankName} onChange={e=>setEmpForm({...empForm, bankName: e.target.value})}>{BANKS.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">No. Rekening / HP E-Wallet</label><input required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono text-[#047857] font-bold outline-none focus:border-[#047857]" value={empForm.bankAccount} onChange={e=>setEmpForm({...empForm, bankAccount: e.target.value})} placeholder="Contoh: 0812xxxx (DANA) atau Rekening Bank" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Skema Gaji</label><select required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={empForm.salaryType} onChange={e=>setEmpForm({...empForm, salaryType: e.target.value})}>{SALARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                          <div><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Status Pegawai</label><select required className={`w-full px-4 py-2.5 border rounded-lg text-sm font-bold outline-none ${(empForm.status || '').toLowerCase() === 'aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`} value={empForm.status} onChange={e=>setEmpForm({...empForm, status: e.target.value})}><option value="Aktif">Aktif</option><option value="Non-Aktif">Non-Aktif</option></select></div>
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Gaji Pokok Dasar (Rp)</label><input required type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={empForm.baseSalary} onChange={e=>setEmpForm({...empForm, baseSalary: e.target.value})} /></div>
                          <div className="md:col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1.5 block">Bonus Kehadiran Harian (Rp)</label><input required type="number" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={empForm.dailyBonus} onChange={e=>setEmpForm({...empForm, dailyBonus: e.target.value})} /></div>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                        <h4 className="text-sm font-bold text-white mb-5 bg-[#0f172a] p-2 rounded-lg inline-block px-4 shadow-sm flex items-center w-fit"><ShieldAlert className="mr-2 text-yellow-400" size={16}/> D. Aturan Khusus Kehadiran & Lembur Individu</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h5 className="text-xs font-bold text-rose-600 border-b border-rose-200 pb-2 uppercase tracking-wide">Potongan Disiplin Waktu</h5>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Toleransi Keterlambatan</label>
                                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-rose-400" value={empForm.lateTolerance} onChange={e=>setEmpForm({...empForm, lateTolerance: e.target.value})}>
                                  <option value="0">Tidak ada toleransi (0 Mnt)</option>
                                  <option value="5">Toleransi 5 Menit</option>
                                  <option value="30">Toleransi 30 Menit</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Denda Telat (Rp/Menit)</label>
                                <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-rose-400" value={empForm.latePenaltyRate} onChange={e=>setEmpForm({...empForm, latePenaltyRate: e.target.value})} placeholder="Contoh: 1000" />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Denda Pulang Cepat (Rp/Menit)</label>
                              <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-rose-400" value={empForm.earlyPenaltyRate} onChange={e=>setEmpForm({...empForm, earlyPenaltyRate: e.target.value})} placeholder="Contoh: 1000" />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h5 className="text-xs font-bold text-[#047857] border-b border-emerald-200 pb-2 uppercase tracking-wide">Pengaturan Hitung Lembur</h5>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Apakah karyawan ini dihitung lemburnya?</label>
                              <select className={`w-full px-3 py-2 border rounded-lg text-sm font-bold outline-none ${empForm.countOvertime === 'Ya' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`} value={empForm.countOvertime} onChange={e=>setEmpForm({...empForm, countOvertime: e.target.value})}>
                                <option value="Tidak">TIDAK Dihitung Lembur</option>
                                <option value="Ya">YA, Hitung Lembur</option>
                              </select>
                            </div>

                            {empForm.countOvertime === 'Ya' && (
                              <div className="flex gap-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex-1">
                                  <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Mulai Hitung Lembur Setelah</label>
                                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-[#047857]" value={empForm.overtimeThreshold} onChange={e=>setEmpForm({...empForm, overtimeThreshold: e.target.value})}>
                                    <option value="0">Tepat Saat Jam Pulang (0 Mnt)</option>
                                    <option value="30">Lewat 30 Menit Jam Pulang</option>
                                    <option value="60">Lewat 1 Jam (60 Mnt) Jam Pulang</option>
                                  </select>
                                </div>
                                <div className="flex-1">
                                  <label className="text-[11px] font-semibold text-gray-600 mb-1.5 block">Tarif Lembur (Rp/Menit)</label>
                                  <input required type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={empForm.overtimeRate} onChange={e=>setEmpForm({...empForm, overtimeRate: e.target.value})} placeholder="Contoh: 1500" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-6 border-t border-gray-200 gap-3">
                        <button type="button" onClick={() => setShowEmpForm(false)} className="bg-gray-100 text-gray-600 rounded-xl px-6 py-3.5 text-sm font-bold hover:bg-gray-200">Batal</button>
                        <button type="submit" className="bg-[#047857] text-white rounded-xl px-8 py-3.5 text-sm font-bold flex items-center hover:bg-[#065f46] shadow-lg">
                          <Database className="mr-2" size={18}/> 
                          {isEditing ? 'Simpan Perubahan' : 'Simpan Karyawan Baru'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Tabel Karyawan */}
                {!showEmpForm && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-[#f8fafc] border-b border-gray-200 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                          <tr>
                            <th className="px-6 py-5">Karyawan & NIK</th>
                            <th className="px-6 py-5">Pekerjaan & Cabang</th>
                            <th className="px-6 py-5">Kontak & Alamat</th>
                            <th className="px-6 py-5">Rekening / E-Wallet</th>
                            <th className="px-6 py-5">Gaji Pokok</th>
                            <th className="px-6 py-5 text-center">Status</th>
                            <th className="px-6 py-5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredEmployees.length === 0 ? (
                            <tr><td colSpan="7" className="text-center py-10 text-gray-400 font-medium italic">Tidak ada karyawan yang cocok dengan pencarian atau filter cabang.</td></tr>
                          ) : (
                            filteredEmployees.map(emp => {
                              const dept = departments.find(d => d.id === emp.department);
                              const branch = branches.find(b => b.id === emp.branch);
                              return (
                              <tr key={emp.id} className="hover:bg-slate-50/50 align-top transition-colors">
                                <td className="px-6 py-4">
                                  <div 
                                    className="flex items-center gap-3 cursor-pointer group p-1.5 -ml-1.5 rounded-xl hover:bg-emerald-50 transition-colors"
                                    onClick={() => setSelectedEmployee(emp)}
                                    title="Klik untuk lihat profil detail"
                                  >
                                    <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-[#047857] font-bold overflow-hidden border border-emerald-200 shadow-sm group-hover:shadow-md transition-all">
                                        {emp.photo ? (
                                            <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <UserCircle size={28}/>
                                        )}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-[#047857] text-[15px] group-hover:text-[#065f46] transition-colors">{emp.name}</div>
                                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">ID: {emp.id} • NIK: {emp.nik || '-'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-gray-800">{emp.position || '-'}</div>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    <div className="text-[9px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 flex items-center"><MapPin className="mr-1" size={10}/>{branch?.name || 'Head Office'}</div>
                                    <div className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">{dept?.name || '-'}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-gray-700 font-medium flex items-center"><Phone className="mr-1.5 text-slate-400" size={12}/> {emp.phone || '-'}</div>
                                  <div className="text-[11px] text-gray-500 mt-1 flex items-center max-w-[200px] truncate"><MapPin className="mr-1.5 text-slate-400 shrink-0" size={12}/> <span className="truncate">{getFullAddress(emp)}</span></div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-[#047857] flex items-center"><CreditCard className="mr-1.5 text-[#B28E25]" size={14}/> {emp.bankName || '-'}</div>
                                  <div className="text-[12px] font-mono text-gray-600 mt-0.5">{emp.bankAccount || '-'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-gray-800">{formatRupiah(emp.baseSalary)} <span className="text-[10px] text-gray-400 font-normal">/{emp.salaryType}</span></div>
                                  <div className="text-[11px] text-[#B28E25] font-bold mt-0.5">+ Bonus {formatRupiah(emp.dailyBonus)}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${(emp.status || '').toLowerCase() === 'aktif' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>{emp.status || 'Aktif'}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={()=>setSelectedEmployee(emp)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors shadow-sm" title="Lihat Profil"><Eye size={16}/></button>
                                    <button onClick={()=>handleEditClick(emp)} className="p-2 bg-orange-50 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Edit Data"><Edit size={16}/></button>
                                    <button onClick={()=>deleteItem(updateEmployees, employees, emp.id)} className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg transition-colors shadow-sm" title="Hapus"><Trash2 size={16}/></button>
                                  </div>
                                </td>
                              </tr>
                            )})
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODAL / POPUP DETAIL KARYAWAN */}
            {selectedEmployee && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 print:hidden animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                  <div className="bg-[#047857] p-5 flex justify-between items-center text-white">
                    <div className="flex items-center">
                      <img src={LogoPerusahaan} alt="Logo" className="h-8 w-8 mr-3 rounded-full object-cover border border-[#B28E25]" />
                      <h3 className="font-bold text-lg tracking-wide">Profil Lengkap Karyawan</h3>
                    </div>
                    <button onClick={() => setSelectedEmployee(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={24}/></button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto bg-gray-50 flex-1">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* KOLOM KIRI */}
                      <div className="space-y-6">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
                          <div className="w-32 h-40 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center mb-3 text-slate-400 overflow-hidden">
                            {selectedEmployee.photo ? (
                                <img src={selectedEmployee.photo} alt={selectedEmployee.name} className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <ImageIcon className="mb-2" size={32}/>
                                    <span className="text-[10px] font-bold uppercase">Foto Profil</span>
                                </>
                            )}
                          </div>
                          <h4 className="font-extrabold text-[#047857] text-lg">{selectedEmployee.name}</h4>
                          <span className={`mt-2 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${(selectedEmployee.status || '').toLowerCase() === 'aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{selectedEmployee.status || 'Aktif'}</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center">
                          <h5 className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider border-b pb-1 w-full text-left">Dokumen KTP</h5>
                          <div className="w-full h-32 bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 overflow-hidden">
                            {selectedEmployee.ktpPhoto ? (
                                <img src={selectedEmployee.ktpPhoto} alt="KTP" className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <ImageIcon className="mb-1" size={28}/>
                                    <span className="text-[9px] font-bold uppercase">Scan / Foto KTP</span>
                                </>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100">
                           <h5 className="text-xs font-bold text-emerald-800 mb-3 uppercase tracking-wider border-b pb-2 flex items-center"><ShieldAlert className="mr-2" size={14}/> Aturan Kehadiran Individu</h5>
                           <div className="space-y-3 text-xs">
                             <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Toleransi Telat</span><span className="font-bold">{selectedEmployee.lateTolerance || '0'} Menit</span></div>
                             <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Denda Telat</span><span className="font-bold text-rose-600">{formatRupiah(selectedEmployee.latePenaltyRate || 0)} / Mnt</span></div>
                             <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Denda Pulang Cepat</span><span className="font-bold text-rose-600">{formatRupiah(selectedEmployee.earlyPenaltyRate || 0)} / Mnt</span></div>
                             
                             <div className="pt-2">
                               <div className="flex justify-between pb-1"><span className="text-gray-500">Status Lembur</span><span className={`font-bold ${selectedEmployee.countOvertime === 'Ya' ? 'text-[#047857]' : 'text-gray-400'}`}>{selectedEmployee.countOvertime === 'Ya' ? 'Dihitung' : 'Tidak Dihitung'}</span></div>
                               {selectedEmployee.countOvertime === 'Ya' && (
                                 <>
                                  <div className="flex justify-between pb-1"><span className="text-gray-500">Batas Hitung Lembur</span><span className="font-bold">+{selectedEmployee.overtimeThreshold || '0'} Menit</span></div>
                                  <div className="flex justify-between pb-1"><span className="text-gray-500">Tarif Lembur</span><span className="font-bold text-[#047857]">{formatRupiah(selectedEmployee.overtimeRate || 0)} / Mnt</span></div>
                                 </>
                               )}
                             </div>
                           </div>
                        </div>
                      </div>

                      {/* KOLOM KANAN */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
                          <h5 className="text-sm font-bold text-[#B28E25] mb-4 border-b border-gray-100 pb-2 flex items-center"><UserCircle className="mr-2" size={18}/> Informasi Pribadi & Alamat</h5>
                          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div><p className="text-gray-500 text-xs mb-1">ID Karyawan</p><p className="font-bold text-gray-900">{selectedEmployee.id}</p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Status Perkawinan</p><p className="font-semibold text-gray-800">{selectedEmployee.maritalStatus || '-'}</p></div>
                            
                            <div><p className="text-gray-500 text-xs mb-1 flex items-center"><FileText className="mr-1" size={12}/> NIK (KTP)</p><p className="font-bold text-gray-900 font-mono">{selectedEmployee.nik || '-'}</p></div>
                            <div><p className="text-gray-500 text-xs mb-1 flex items-center"><FileSignature className="mr-1" size={12}/> NPWP</p><p className="font-bold text-gray-900 font-mono">{selectedEmployee.npwp || '-'}</p></div>
                            
                            <div><p className="text-gray-500 text-xs mb-1 flex items-center"><Phone className="mr-1" size={12}/> Nomor Handphone</p><p className="font-semibold text-gray-800">{selectedEmployee.phone || '-'}</p></div>
                            <div><p className="text-gray-500 text-xs mb-1 flex items-center"><Mail className="mr-1" size={12}/> Email</p><p className="font-semibold text-blue-600">{selectedEmployee.email || '-'}</p></div>
                            
                            <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                              <p className="text-gray-500 text-xs mb-1 flex items-center"><MapPin className="mr-1" size={12}/> Alamat Domisili Lengkap</p>
                              <p className="font-semibold text-gray-800 leading-relaxed">{getFullAddress(selectedEmployee)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100">
                          <h5 className="text-sm font-bold text-[#B28E25] mb-4 border-b border-gray-100 pb-2 flex items-center"><Briefcase className="mr-2" size={18}/> Pekerjaan & Keuangan</h5>
                          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                            <div className="col-span-2">
                              <p className="text-gray-500 text-xs mb-1">Cabang Penempatan</p>
                              <p className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg inline-flex items-center"><MapPin className="mr-1.5 text-blue-600" size={14}/> {branches.find(b => b.id === selectedEmployee.branch)?.name || 'Head Office'}</p>
                            </div>
                            <div><p className="text-gray-500 text-xs mb-1">Departemen</p><p className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 inline-block">{departments.find(d => d.id === selectedEmployee.department)?.name || '-'}</p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Posisi / Jabatan</p><p className="font-bold text-gray-900">{selectedEmployee.position || '-'}</p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Gaji Pokok</p><p className="font-extrabold text-[#047857]">{formatRupiah(selectedEmployee.baseSalary)} <span className="text-[10px] text-gray-400 font-normal">/{selectedEmployee.salaryType}</span></p></div>
                            <div><p className="text-gray-500 text-xs mb-1">Bonus Kehadiran Harian</p><p className="font-bold text-emerald-600">{formatRupiah(selectedEmployee.dailyBonus)}</p></div>
                            
                            <div className="col-span-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 mt-2 flex justify-between items-center">
                              <div>
                                <p className="text-emerald-800 text-xs font-bold mb-1 flex items-center"><CreditCard className="mr-1.5" size={14}/> Informasi Rekening / E-Wallet</p>
                                <p className="font-mono text-[#047857] text-base font-extrabold">{selectedEmployee.bankAccount || '-'}</p>
                              </div>
                              <div className="text-right">
                                <span className="bg-[#B28E25] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{selectedEmployee.bankName || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-100 p-4 border-t border-gray-200 flex justify-end gap-3">
                    <button onClick={() => { setSelectedEmployee(null); handleEditClick(selectedEmployee); }} className="px-6 py-2 bg-[#B28E25] text-white rounded-lg font-bold hover:bg-[#8f711b] transition-colors flex items-center"><Edit className="mr-2" size={16}/> Edit Data Ini</button>
                    <button onClick={() => setSelectedEmployee(null)} className="px-6 py-2 bg-gray-400 text-white rounded-lg font-bold hover:bg-gray-500 transition-colors">Tutup Jendela</button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB PENGATURAN CABANG, DEPARTEMEN & SHIFT */}
            {activeTab === 'master' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                
                <div className="space-y-8">
                  {/* MASTER CABANG */}
                  <div>
                    <h3 className="text-lg font-bold text-[#047857] flex items-center mb-4"><MapPin className="mr-2 text-[#B28E25]"/> Pengaturan Cabang Perusahaan</h3>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-4">
                      <form onSubmit={handleAddBranch} className="flex gap-4 items-end">
                        <div className="w-1/3"><label className="text-xs font-semibold text-gray-500 mb-1.5 block">ID Cabang</label><input required className="w-full px-4 py-2 border border-blue-200 rounded-lg text-sm bg-blue-50 text-blue-800 font-bold outline-none" value={branchForm.id} onChange={e=>setBranchForm({...branchForm, id: e.target.value.toUpperCase()})} placeholder="BR-XXX"/></div>
                        <div className="flex-1"><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nama Kantor / Cabang</label><input required className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500" value={branchForm.name} onChange={e=>setBranchForm({...branchForm, name: e.target.value})} placeholder="Contoh: HBA Makassar"/></div>
                        <button type="submit" className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-blue-700 h-[38px] shadow-md">Tambah</button>
                      </form>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <table className="w-full text-sm text-left"><thead className="bg-[#f8fafc] border-b text-slate-500 text-[11px] uppercase font-bold"><tr><th className="px-6 py-3">ID Cabang</th><th className="px-6 py-3">Nama Cabang</th><th className="px-6 py-3 text-right">Aksi</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">{branches.map(b => <tr key={b.id} className="hover:bg-slate-50"><td className="px-6 py-3 font-mono text-xs font-bold text-blue-700">{b.id}</td><td className="px-6 py-3 font-bold text-gray-800">{b.name}</td><td className="px-6 py-3 text-right"><button onClick={()=>deleteItem(updateBranches, branches, b.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
                    </div>
                  </div>

                  {/* MASTER DEPARTEMEN */}
                  <div>
                    <h3 className="text-lg font-bold text-[#047857] flex items-center mb-4"><Building2 className="mr-2 text-[#B28E25]"/> Pengaturan Departemen</h3>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-4">
                      <form onSubmit={handleAddDept} className="flex flex-col gap-4">
                        <div className="flex gap-4 items-end">
                          <div className="w-1/3"><label className="text-xs font-semibold text-gray-500 mb-1.5 block">ID Dept</label><input required className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-emerald-50 text-[#047857] font-bold outline-none" value={deptForm.id} onChange={e=>setDeptForm({...deptForm, id: e.target.value.toUpperCase()})} placeholder="DEP-XXX"/></div>
                          <div className="flex-1"><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nama Departemen</label><input required className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={deptForm.name} onChange={e=>setDeptForm({...deptForm, name: e.target.value})} placeholder="Contoh: IT Support"/></div>
                        </div>
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <label className="flex items-center cursor-pointer">
                            <input type="checkbox" checked={deptForm.saturdayHalfDay || false} onChange={e => setDeptForm({...deptForm, saturdayHalfDay: e.target.checked})} className="mr-2 w-4 h-4 text-[#047857] rounded cursor-pointer" />
                            <span className="text-xs text-gray-700 font-bold cursor-pointer">Aturan Sabtu Setengah Hari (Pulang 15:00)</span>
                          </label>
                          <button type="submit" className="bg-[#B28E25] text-white rounded-lg px-5 py-2 text-sm font-bold hover:bg-[#8f711b] shadow-md">Simpan Departemen</button>
                        </div>
                      </form>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <table className="w-full text-sm text-left"><thead className="bg-[#f8fafc] border-b text-slate-500 text-[11px] uppercase font-bold"><tr><th className="px-6 py-3">ID Dept</th><th className="px-6 py-3">Nama Departemen</th><th className="px-6 py-3 text-center">Aturan Sabtu</th><th className="px-6 py-3 text-right">Aksi</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">{departments.map(d => <tr key={d.id} className="hover:bg-slate-50"><td className="px-6 py-3 font-mono text-xs font-bold text-[#047857]">{d.id}</td><td className="px-6 py-3 font-bold text-gray-800">{d.name}</td>
                      <td className="px-6 py-3 text-center">
                        {(d.saturdayHalfDay === true || String(d.saturdayHalfDay).toUpperCase() === 'TRUE') ? <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">Pulang 15:00</span> : <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold">Normal</span>}
                      </td>
                      <td className="px-6 py-3 text-right"><button onClick={()=>deleteItem(updateDepartments, departments, d.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* MASTER SHIFT KERJA */}
                  <h3 className="text-lg font-bold text-[#047857] flex items-center"><Clock className="mr-2 text-[#B28E25]"/> Pengaturan Shift Kerja</h3>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <form onSubmit={handleAddShift} className="grid grid-cols-2 gap-4 items-end">
                      <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">ID Shift</label><input required className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-orange-50 font-bold outline-none" value={shiftForm.id} onChange={e=>setShiftForm({...shiftForm, id: e.target.value.toUpperCase()})} placeholder="SH-XXX"/></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nama Shift</label><input required className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={shiftForm.name} onChange={e=>setShiftForm({...shiftForm, name: e.target.value})} placeholder="Contoh: Shift Malam"/></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Jam Masuk (00:00)</label><input required type="time" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={shiftForm.timeIn} onChange={e=>setShiftForm({...shiftForm, timeIn: e.target.value})} /></div>
                      <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Jam Pulang (00:00)</label><input required type="time" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={shiftForm.timeOut} onChange={e=>setShiftForm({...shiftForm, timeOut: e.target.value})} /></div>
                      <div className="col-span-2"><button type="submit" className="w-full bg-[#047857] text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-[#065f46] shadow-md">Simpan Shift Baru</button></div>
                    </form>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left"><thead className="bg-[#f8fafc] border-b text-slate-500 text-[11px] uppercase font-bold"><tr><th className="px-6 py-3">Info Shift</th><th className="px-6 py-3 text-center">Waktu Kerja</th><th className="px-6 py-3 text-right">Aksi</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">{masterShifts.map(s => <tr key={s.id} className="hover:bg-slate-50"><td className="px-6 py-3"><div className="font-bold text-gray-800">{s.name}</div><div className="font-mono text-[10px] text-slate-500">{s.id}</div></td><td className="px-6 py-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50 rounded border border-emerald-100">{s.timeIn} - {s.timeOut}</td><td className="px-6 py-3 text-right"><button onClick={()=>deleteItem(updateMasterShifts, masterShifts, s.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB JADWAL SHIFT */}
            {activeTab === 'jadwal_shift' && (
              <div className="space-y-6">
                
                {globalBranchFilter && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm flex items-center shadow-sm">
                    <MapPin className="mr-2" size={16}/> Sedang memfilter penjadwalan hanya untuk cabang: <strong>{branches.find(b => b.id === globalBranchFilter)?.name}</strong>
                  </div>
                )}

                {/* FORM TAMBAH JADWAL */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex gap-6 mb-6 pb-4 border-b border-gray-100">
                    <label className="flex items-center cursor-pointer"><input type="radio" name="assignType" className="w-4 h-4 text-[#047857] mr-2" checked={scheduleAssignType === 'department'} onChange={() => {setScheduleAssignType('department'); setScheduleForm({...scheduleForm, targetId: ''})}} /> <span className="font-bold text-sm">Penugasan Massal (Per Departemen)</span></label>
                    <label className="flex items-center cursor-pointer"><input type="radio" name="assignType" className="w-4 h-4 text-[#047857] mr-2" checked={scheduleAssignType === 'employee'} onChange={() => {setScheduleAssignType('employee'); setScheduleForm({...scheduleForm, targetId: ''})}} /> <span className="font-bold text-sm">Penugasan Individu (Per Karyawan)</span></label>
                  </div>
                  <form onSubmit={handleAddSchedule} className="grid grid-cols-1 md:grid-cols-5 gap-5 items-end">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-500 mb-1.5 block">{scheduleAssignType === 'department' ? 'Pilih Departemen Target' : 'Pilih Karyawan Target'}</label>
                      <select required className="w-full px-4 py-2.5 border border-emerald-300 rounded-lg text-sm bg-emerald-50 text-[#047857] font-bold outline-none" value={scheduleForm.targetId} onChange={e=>setScheduleForm({...scheduleForm, targetId: e.target.value})}>
                        <option value="">-- Pilih Target --</option>
                        {scheduleAssignType === 'department' 
                          ? departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>) 
                          : baseFilteredEmployees.filter(e => e.status === undefined || e.status === null || String(e.status).toLowerCase() === 'aktif').map(emp => <option key={emp.id} value={emp.id}>{emp.name} (ID: {emp.id})</option>)
                        }
                      </select>
                    </div>
                    <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Master Shift</label><select required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:border-[#047857]" value={scheduleForm.shiftId} onChange={e=>setScheduleForm({...scheduleForm, shiftId: e.target.value})}><option value="">Pilih Shift</option>{masterShifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Mulai Tgl</label><input required type="date" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={scheduleForm.startDate} onChange={e=>setScheduleForm({...scheduleForm, startDate: e.target.value})} /></div>
                    <div><label className="text-xs font-semibold text-gray-500 mb-1.5 block">Sampai Tgl</label><input required type="date" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={scheduleForm.endDate} onChange={e=>setScheduleForm({...scheduleForm, endDate: e.target.value})} /></div>
                    <div className="md:col-span-5 flex justify-end mt-2"><button type="submit" className="bg-[#B28E25] text-white rounded-xl px-8 py-3 text-sm font-bold flex items-center hover:bg-[#8f711b] shadow-md"><CalendarRange className="mr-2" size={18}/> Generate Jadwal ke Database</button></div>
                  </form>
                </div>

                {/* TABEL JADWAL BERKELOMPOK */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#f8fafc] border-b border-gray-200 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Karyawan & Departemen</th>
                        <th className="px-6 py-4">Status Shift Saat Ini</th>
                        <th className="px-6 py-4">Total Riwayat</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {baseFilteredEmployees
                        .filter(emp => schedules.some(s => s.empId === emp.id))
                        .map(emp => {
                          const empSchedules = schedules.filter(s => s.empId === emp.id).sort((a,b) => new Date(b.startDate) - new Date(a.startDate));
                          const dept = departments.find(d => d.id === emp.department);
                          const currentSchedule = empSchedules.find(s => s.startDate <= todayStr && s.endDate >= todayStr);
                          const currentShift = currentSchedule ? masterShifts.find(ms => ms.id === currentSchedule.shiftId) : null;
                          const isExpanded = expandedEmpId === emp.id;

                          return (
                            <React.Fragment key={emp.id}>
                              <tr className={`cursor-pointer transition-colors ${isExpanded ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`} onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}>
                                <td className="px-6 py-4">
                                  <div className="font-extrabold text-gray-900">{emp.name}</div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">{dept?.name || '-'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  {currentShift ? (
                                    <span className="bg-emerald-100 text-[#047857] px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 inline-flex items-center">
                                      <Play className="mr-1.5 fill-current" size={12}/> Aktif: {currentShift.name}
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200">
                                      Tidak ada shift berjalan
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-xs font-bold text-gray-500">
                                  {empSchedules.length} Riwayat Shift
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button className={`font-bold text-xs inline-flex items-center justify-end px-3 py-1.5 rounded-lg border transition-colors ${isExpanded ? 'bg-[#047857] text-white border-[#065f46]' : 'bg-[#B28E25]/10 text-[#B28E25] border-[#B28E25]/20 hover:bg-[#B28E25] hover:text-white'}`}>
                                    {isExpanded ? <><ChevronUp className="mr-1" size={14}/> Tutup</> : <><ChevronDown className="mr-1" size={14}/> Lihat Detail</>}
                                  </button>
                                </td>
                              </tr>

                              {isExpanded && (
                                <tr>
                                  <td colSpan="4" className="px-0 py-0 bg-gray-50/80 border-b border-gray-200">
                                    <div className="p-5 pl-8 border-l-4 border-[#047857] shadow-inner">
                                      <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase flex items-center">
                                        <Clock className="mr-2 text-[#047857]" size={14}/> Riwayat Penugasan Shift: {emp.name}
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {empSchedules.map(sch => {
                                          const shf = masterShifts.find(s => s.id === sch.shiftId);
                                          const isActive = sch.startDate <= todayStr && sch.endDate >= todayStr;
                                          return (
                                            <div key={sch.id} className={`p-3 rounded-xl border ${isActive ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-white border-gray-200'} flex justify-between items-center transition-all hover:shadow-md`}>
                                              <div>
                                                <div className={`text-xs font-extrabold ${isActive ? 'text-[#047857]' : 'text-gray-800'}`}>
                                                  {shf?.name || sch.shiftId} 
                                                  {isActive && <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded ml-2 uppercase">Aktif</span>}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-1 font-medium bg-gray-100 px-1.5 py-0.5 rounded inline-block">
                                                  {sch.startDate} s/d {sch.endDate}
                                                </div>
                                              </div>
                                              <button onClick={(e)=>{ e.stopPropagation(); deleteItem(updateSchedules, schedules, sch.id); }} className="text-rose-400 hover:text-white p-2 bg-rose-50 hover:bg-rose-500 rounded-lg transition-colors shadow-sm" title="Hapus Jadwal Ini">
                                                <Trash2 size={14}/>
                                              </button>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                      }

                      {baseFilteredEmployees.filter(emp => schedules.some(s => s.empId === emp.id)).length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center py-10 text-gray-400 font-medium italic">
                            Belum ada jadwal shift yang ditugaskan ke karyawan di cabang ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB ABSENSI & IMPORT */}
            {activeTab === 'absensi' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-base font-bold text-[#047857]">Data CSV Absensi</h3>
                      {csvData.trim() !== '' && (
                        <button onClick={() => setCsvData('')} className="text-[11px] text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-500 px-3 py-1 rounded-full font-bold transition-colors">
                          Bersihkan Kotak
                        </button>
                      )}
                    </div>
                    <textarea 
                      className="w-full flex-1 min-h-[200px] p-4 text-sm font-mono border border-gray-300 rounded-xl bg-gray-50 focus:bg-white outline-none focus:border-[#047857] transition-all placeholder:text-gray-400" 
                      value={csvData} 
                      onChange={(e) => setCsvData(e.target.value)} 
                      placeholder={"Paste data CSV dari mesin absensi di sini...\n\nFormat Contoh:\nID_KARYAWAN TANGGAL SCAN_MASUK SCAN_PULANG\n113 01/09/2026 08:35 17:05\n114 01/09/2026 08:00 17:00"}
                    />
                    <button onClick={processImport} className="mt-4 w-full bg-[#047857] hover:bg-[#065f46] text-white text-sm font-bold py-3 rounded-xl shadow-md flex items-center justify-center transition-colors">
                      <Play className="w-4 h-4 mr-2" fill="currentColor"/> Proses Absensi Pintar
                    </button>
                  </div>
                  
                  <div className="bg-[#0f172a] rounded-2xl shadow-sm border border-slate-800 p-6 flex flex-col min-h-[300px]">
                    <h3 className="text-[#B28E25] text-sm font-bold mb-4 border-b border-slate-700 pb-3 flex items-center"><Settings2 className="mr-2" size={16}/> Terminal Log Aktivitas</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 text-[12px] font-mono">{importLogs.length === 0 ? <p className="text-slate-500">Menunggu sistem memproses data...</p> : importLogs.map((log, idx) => (<div key={idx} className={`flex items-start ${log.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}><span className="mr-2">[{log.type === 'error' ? 'X' : '✓'}]</span><span>Baris {log.row}: {log.msg}</span></div>))}</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-[#f8fafc] border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
                    <h3 className="text-[13px] text-gray-700 font-bold flex items-center">
                      <Filter className="mr-2 text-[#047857]" size={16}/> Riwayat Data Absensi {globalBranchFilter && <span className="ml-2 bg-emerald-100 text-[#047857] px-2 py-0.5 rounded text-[10px]">📍 {branches.find(b=>b.id===globalBranchFilter)?.name}</span>}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus-within:border-[#047857] shadow-sm transition-colors">
                          <span className="text-[10px] text-gray-500 font-bold mr-2 uppercase">Periode:</span>
                          <input type="date" title="Mulai Tanggal" className="text-xs outline-none focus:text-[#047857] font-bold bg-transparent cursor-pointer" value={attStartDate} onChange={(e) => setAttStartDate(e.target.value)} />
                          <span className="text-gray-400 text-xs mx-1">-</span>
                          <input type="date" title="Sampai Tanggal" className="text-xs outline-none focus:text-[#047857] font-bold bg-transparent cursor-pointer" value={attEndDate} onChange={(e) => setAttEndDate(e.target.value)} />
                        </div>
                        <select
                          className="px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#047857] bg-white shadow-sm font-medium"
                          value={attFilterDept}
                          onChange={(e) => setAttFilterDept(e.target.value)}
                        >
                          <option value="">Semua Departemen</option>
                          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <input type="text" placeholder="Cari nama / ID pegawai..." className="px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#047857] w-48 shadow-sm" value={attSearchTerm} onChange={(e) => setAttSearchTerm(e.target.value)} />
                      </div>
                      <button onClick={handleClearAllAttendance} className="flex items-center text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-colors shadow-sm">
                        <Trash2 className="mr-1.5" size={14}/> Kosongkan Tabel
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left"><thead className="bg-[#f8fafc] border-b border-gray-200 text-slate-500 text-[11px] uppercase font-bold tracking-wider"><tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Karyawan & Dept</th><th className="px-6 py-4">Shift</th><th className="px-6 py-4 text-center">Masuk</th><th className="px-6 py-4 text-center">Pulang</th><th className="px-6 py-4 text-center">Catatan Waktu</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayAttendances.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-8 text-gray-400 font-medium">Tidak ada data absensi yang sesuai filter.</td></tr>
                      ) : displayAttendances.map(att => { 
                        const emp = employees.find(e => e.id === att.empId); 
                        const dept = departments.find(d => d.id === emp?.department); 
                        return (
                          <tr key={att.id} className="hover:bg-slate-50/50 align-middle">
                            <td className="px-6 py-4 text-gray-700 font-bold whitespace-nowrap">{att.date}</td>
                            <td className="px-6 py-4"><div className="font-bold text-[#047857]">{emp?.name || att.empId}</div><div className="text-[10px] text-gray-500 mt-0.5">{dept?.name}</div></td>
                            <td className="px-6 py-4"><span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md text-[11px] font-bold border border-slate-200">{att.shiftName}</span></td>
                            <td className="px-6 py-4 text-center font-mono font-bold text-[#047857]">{att.scanIn}</td>
                            <td className="px-6 py-4 text-center font-mono font-bold text-gray-600">{att.scanOut || '-'}</td>
                            <td className="px-6 py-4 text-center">
                              {att.isLibur ? (
                                <span className="text-purple-600 font-bold bg-purple-50 border border-purple-200 px-3 py-0.5 rounded-full text-[10px]">Hari Libur</span>
                              ) : (
                                <div className="flex flex-col items-center gap-1.5">
                                  {att.lateMinutes > 0 && <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-3 py-0.5 rounded-full text-[10px]">Telat {att.lateMinutes} mnt</span>}
                                  {att.earlyMinutes > 0 && <span className="text-orange-600 font-bold bg-orange-50 border border-orange-100 px-3 py-0.5 rounded-full text-[10px]">Cepat {att.earlyMinutes} mnt</span>}
                                  {att.rawOvertimeMinutes > 0 && <span className="text-blue-600 font-bold bg-blue-50 border border-blue-100 px-3 py-0.5 rounded-full text-[10px]">Lembur {att.rawOvertimeMinutes} mnt</span>}
                                  {!att.scanOut && <span className="text-slate-600 font-bold bg-slate-100 border border-slate-200 px-3 py-0.5 rounded-full text-[10px]">Lupa Absen</span>}
                                  {att.lateMinutes === 0 && att.earlyMinutes === 0 && att.rawOvertimeMinutes === 0 && att.scanOut && <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-3 py-0.5 rounded-full text-[10px]">Sesuai</span>}
                                </div>
                              )}
                            </td>
                          </tr>
                        ) 
                      })}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB PENGGAJIAN & SLIP */}
            {activeTab === 'penggajian' && (
               <div className="space-y-6">
                
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                  <div className="flex flex-wrap gap-4">
                    <div><label className="block text-xs font-bold text-[#047857] mb-2 uppercase tracking-wide">Periode Mulai</label><input type="date" className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={payrollPeriod.startDate} onChange={e=>setPayrollPeriod({...payrollPeriod, startDate: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-[#047857] mb-2 uppercase tracking-wide">Periode Sampai</label><input type="date" className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#047857]" value={payrollPeriod.endDate} onChange={e=>setPayrollPeriod({...payrollPeriod, endDate: e.target.value})} /></div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-800 text-sm flex-1 xl:max-w-md">
                    <ShieldAlert className="mr-3 text-emerald-600 shrink-0" size={20}/>
                    <div>
                      <strong>Sistem Otomatis Aktif</strong><br/>
                      <span className="text-[11px]">Denda keterlambatan dan uang lembur sekarang dihitung otomatis sesuai aturan yang Anda tetapkan di <b>Database Pegawai</b>.</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#f8fafc] p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center mb-4">
                  <div className="text-[13px] text-gray-700 font-bold flex items-center mr-2">
                    <Filter className="mr-2 text-[#047857]" size={16}/> Filter Data Gaji:
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cari Nama / ID Karyawan..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#047857]"
                      value={payrollSearchTerm}
                      onChange={(e) => setPayrollSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="w-64">
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#047857] bg-white"
                      value={payrollFilterDept}
                      onChange={(e) => setPayrollFilterDept(e.target.value)}
                    >
                      <option value="">Semua Departemen</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="bg-white border border-gray-300 px-3 py-2 rounded-lg text-xs font-bold text-gray-500 cursor-not-allowed hidden md:block">
                    📍 {globalBranchFilter ? branches.find(b=>b.id===globalBranchFilter)?.name : 'Semua Cabang'}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto pb-10">
                  <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-[#f8fafc] border-b border-gray-200 text-slate-500 text-[11px] uppercase font-bold tracking-wider"><tr><th className="px-5 py-4">Karyawan</th><th className="px-5 py-4 text-center">Hadir</th><th className="px-5 py-4 text-right">Gaji + Bonus</th><th className="px-5 py-4 text-right bg-blue-50/50 text-blue-800 border-l border-blue-100">Lembur</th><th className="px-5 py-4 min-w-[200px]">Pemasukan Lain</th><th className="px-5 py-4 text-right bg-rose-50/50 text-rose-800 border-l border-r border-rose-100">Denda Waktu</th><th className="px-5 py-4 min-w-[200px]">Potongan Lain</th><th className="px-5 py-4 text-right bg-emerald-50/50 text-emerald-800 border-l border-emerald-100">Total Bersih</th><th className="px-5 py-4 text-center">Slip</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayPayrollData.length === 0 ? (
                      <tr><td colSpan="9" className="text-center py-8 text-gray-400 font-medium italic">Tidak ada data penggajian yang sesuai dengan filter pencarian Anda.</td></tr>
                    ) : (
                      displayPayrollData.map((data) => (
                      <tr key={data.id} className="hover:bg-slate-50/50 align-top">
                        <td className="px-5 py-4"><div className="font-bold text-[#047857]">{data.name}</div><div className="text-[10px] text-gray-500 mt-0.5">{data.position || '-'}</div></td>
                        <td className="px-5 py-4 text-center"><span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200">{data.totalDays} Hari</span></td>
                        <td className="px-5 py-4 text-right"><div className="font-semibold text-gray-700">{formatRupiah(data.calculatedBaseSalary)}</div><div className="text-[11px] text-[#B28E25] font-bold mt-1">+{formatRupiah(data.totalBonus)}</div></td>
                        <td className="px-5 py-4 text-right bg-blue-50/20 border-l border-blue-50">
                          <div className="text-blue-600 font-bold">+{formatRupiah(data.overtimePay)}</div>
                          <div className="text-[10px] text-blue-400 mt-1.5 leading-tight">Total: <span className="font-semibold">{data.totalPaidOvertimeMinutes} m</span></div>
                        </td>
                        <td className="px-5 py-4"><div className="space-y-2">{(additionalIncomes[data.id] || []).map((inc, i) => (<div key={i} className="flex items-center gap-1.5"><input type="text" placeholder="Ket" className="w-20 text-[11px] px-2 py-1.5 border rounded outline-none focus:border-[#B28E25]" value={inc.desc} onChange={(e) => handleUpdateExtra(data.id, i, 'desc', e.target.value, 'income')} /><input type="number" placeholder="Rp" className="w-20 text-[11px] px-2 py-1.5 border rounded outline-none focus:border-[#B28E25]" value={inc.amount} onChange={(e) => handleUpdateExtra(data.id, i, 'amount', e.target.value, 'income')} /><button onClick={() => handleRemoveExtra(data.id, i, 'income')} className="text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button></div>))}<button onClick={() => handleAddExtra(data.id, 'income')} className="text-[10px] text-emerald-600 font-bold flex items-center bg-emerald-50 px-2 py-1 rounded w-fit border border-emerald-100"><Plus className="mr-1" size={12}/> Tambah</button></div></td>
                        <td className="px-5 py-4 text-right bg-rose-50/20 border-l border-r border-rose-50"><div className="text-rose-600 font-bold">-{formatRupiah(data.latePenalty + data.earlyPenalty)}</div><div className="text-[10px] text-rose-400 mt-1.5 leading-tight space-y-0.5"><div>Telat (Valid): <span className="font-semibold">{data.totalPenalizedLateMinutes} m</span></div><div>Cepat: <span className="font-semibold">{data.totalEarlyMinutes} m</span></div></div></td>
                        <td className="px-5 py-4"><div className="space-y-2">{(customDeductions[data.id] || []).map((ded, i) => (<div key={i} className="flex items-center gap-1.5"><input type="text" placeholder="Ket" className="w-20 text-[11px] px-2 py-1.5 border rounded outline-none focus:border-rose-400" value={ded.desc} onChange={(e) => handleUpdateExtra(data.id, i, 'desc', e.target.value, 'deduction')} /><input type="number" placeholder="Rp" className="w-20 text-[11px] px-2 py-1.5 border rounded outline-none focus:border-rose-400" value={ded.amount} onChange={(e) => handleUpdateExtra(data.id, i, 'amount', e.target.value, 'deduction')} /><button onClick={() => handleRemoveExtra(data.id, i, 'deduction')} className="text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button></div>))}<button onClick={() => handleAddExtra(data.id, 'deduction')} className="text-[10px] text-rose-600 font-bold flex items-center bg-rose-50 px-2 py-1 rounded w-fit border border-rose-100"><Plus className="mr-1" size={12}/> Tambah</button></div></td>
                        <td className="px-5 py-4 text-right font-extrabold text-[#047857] bg-emerald-50/30 border-l border-emerald-50 text-[15px]">{formatRupiah(data.netSalary)}</td>
                        <td className="px-5 py-4 text-center"><button onClick={() => {setPrintType('slip'); setPrintData([data]); setTimeout(() => window.print(), 200);}} className="p-2 bg-slate-100 text-[#B28E25] hover:bg-[#B28E25] hover:text-white rounded-lg shadow-sm transition-colors" title="Cetak Slip Ini"><Printer size={18}/></button></td>
                      </tr>
                    ))
                  )}
                  </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ======================= TEMPLATE KERTAS CETAK (PDF/PRINTER) ======================= */}
      <div className="hidden print:block w-full bg-white text-black font-sans">
        {printData && printType === 'slip' && chunkArray(printData, 6).map((pageGroup, pageIndex) => (
          <div key={pageIndex} className="w-[210mm] mx-auto p-4 box-border" style={{ pageBreakAfter: 'always' }}>
            <div className="grid grid-cols-2 gap-4">
              {pageGroup.map((data, index) => {
                const dept = departments.find(d => d.id === data.department);
                const branch = branches.find(b => b.id === data.branch);
                return (
                <div key={index} className="border border-gray-400 border-dashed rounded p-3 flex flex-col h-[8.8cm]">
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2">
                    <div className="flex items-center">
                      <img src={LogoPerusahaan} alt="Logo" className="h-6 w-auto mr-1.5 object-contain" />
                      <div>
                        <h2 className="text-[10px] font-extrabold tracking-wide" style={{ color: '#B28E25' }}>PT. HARVESTAMA BIOTA ALAM</h2>
                        <p className="text-[6px] text-gray-500 font-bold">{branch?.name || 'Head Office'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h1 className="text-[12px] font-extrabold text-[#047857] uppercase tracking-widest leading-tight">Slip Gaji</h1>
                      <p className="text-[7px] font-bold text-gray-600 mt-0.5 uppercase">Periode: {payrollPeriod.startDate} - {payrollPeriod.endDate}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[8px] mb-2 bg-gray-50 p-1.5 border border-gray-200 rounded">
                    <div>
                      <div><span className="text-gray-500 w-12 inline-block">ID / NIK</span>: <span className="font-bold">{data.id} / {data.nik || '-'}</span></div>
                      <div><span className="text-gray-500 w-12 inline-block">Nama</span>: <span className="font-bold">{data.name}</span></div>
                    </div>
                    <div className="text-right">
                      <div><span className="text-gray-500">Jabatan</span>: {data.position || '-'} ({dept?.name || '-'})</div>
                      <div><span className="text-gray-500">Hadir</span>: <span className="font-bold text-[#047857]">{data.totalDays} Hari</span></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-[8px] flex-1">
                    <div>
                      <div className="font-bold border-b border-gray-300 mb-1 pb-0.5 text-[#047857]">PENERIMAAN</div>
                      <div className="flex justify-between mb-0.5"><span className="truncate pr-1">Gaji Pokok</span><span>{formatRupiah(data.calculatedBaseSalary)}</span></div>
                      
                      {data.totalBonus > 0 && (
                        <div className="flex justify-between mb-0.5"><span className="truncate pr-1">Bonus Kehadiran</span><span>{formatRupiah(data.totalBonus)}</span></div>
                      )}

                      {data.overtimePay > 0 && (
                        <div className="flex justify-between mb-0.5 text-blue-700"><span className="truncate pr-1">Uang Lembur ({data.totalPaidOvertimeMinutes}m)</span><span>{formatRupiah(data.overtimePay)}</span></div>
                      )}

                      {data.empIncomes.map((inc, i) => (
                        <div key={i} className="flex justify-between mb-0.5"><span className="truncate pr-1 capitalize">{inc.desc || 'Lainnya'}</span><span>{formatRupiah(inc.amount || 0)}</span></div>
                      ))}
                    </div>
                    <div>
                      <div className="font-bold border-b border-gray-300 mb-1 pb-0.5 text-red-600">POTONGAN</div>
                      {data.latePenalty > 0 && (
                        <div className="flex justify-between text-red-600 mb-0.5"><span className="truncate pr-1">Telat ({data.totalPenalizedLateMinutes}m)</span><span>-{formatRupiah(data.latePenalty)}</span></div>
                      )}
                      {data.earlyPenalty > 0 && (
                        <div className="flex justify-between text-red-600 mb-0.5"><span className="truncate pr-1">Cepat ({data.totalEarlyMinutes}m)</span><span>-{formatRupiah(data.earlyPenalty)}</span></div>
                      )}
                      {data.empDeductions.map((ded, i) => (
                        <div key={i} className="flex justify-between text-red-600 mb-0.5"><span className="truncate pr-1 capitalize">{ded.desc || 'Lainnya'}</span><span>-{formatRupiah(ded.amount || 0)}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t-2 border-gray-300 mt-1 pt-1.5 flex justify-between items-end">
                    <div className="text-[7px] text-gray-500 max-w-[50%]">
                      <strong>DITRANSFER KE:</strong><br/>
                      {data.bankName || '-'}<br/>
                      No. Rek/HP: <span className="font-mono">{data.bankAccount || '-'}</span><br/>
                      A.N. {data.name}
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded px-3 py-1.5 text-right">
                      <div className="text-[7px] font-bold text-[#047857] uppercase mb-0.5">Total Diterima (Take Home Pay)</div>
                      <div className="text-[12px] font-extrabold text-[#047857]">{formatRupiah(data.netSalary)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between mt-2.5 px-4 text-[8px] text-center">
                    <div><p className="mb-5 text-gray-500">Karyawan,</p><p className="font-bold underline">{data.name}</p></div>
                    <div><p className="mb-5 text-gray-500">HRD Manager,</p><p className="font-bold underline">Admin HRD</p></div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}

        {printData && printType === 'pegawai' && (
          <div className="w-[210mm] mx-auto p-8 box-border">
            <div className="flex items-center justify-between border-b-4 border-[#047857] pb-4 mb-6">
              <div className="flex items-center">
                <img src={LogoPerusahaan} alt="Logo" className="h-14 w-auto mr-4 object-contain" />
                <div>
                  <h1 className="text-xl font-extrabold tracking-wide" style={{ color: '#B28E25' }}>PT. HARVESTAMA BIOTA ALAM</h1>
                  <p className="text-sm font-bold text-[#047857]">DATABASE KARYAWAN PERUSAHAAN</p>
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>Dicetak Pada: {new Date().toLocaleDateString('id-ID')}</p>
                <p className="font-bold text-[#047857]">FILTER: {globalBranchFilter ? branches.find(b=>b.id===globalBranchFilter)?.name : 'Semua Cabang'}</p>
                <p>Total: {printData.length} Karyawan</p>
              </div>
            </div>
            
            <table className="w-full text-[10px] text-left border-collapse border border-gray-300">
              <thead className="bg-[#047857] text-white">
                <tr>
                  <th className="border border-gray-300 px-2 py-1.5">No</th>
                  <th className="border border-gray-300 px-2 py-1.5">ID & NIK</th>
                  <th className="border border-gray-300 px-2 py-1.5">Nama & Kontak</th>
                  <th className="border border-gray-300 px-2 py-1.5">Cabang & Departemen</th>
                  <th className="border border-gray-300 px-2 py-1.5">Alamat Domisili</th>
                  <th className="border border-gray-300 px-2 py-1.5">Rekening / E-Wallet</th>
                </tr>
              </thead>
              <tbody>
                {printData.map((emp, idx) => {
                  const dept = departments.find(d => d.id === emp.department);
                  const branch = branches.find(b => b.id === emp.branch);
                  return (
                  <tr key={emp.id} className="border-b border-gray-300">
                    <td className="border border-gray-300 px-2 py-1.5 text-center">{idx + 1}</td>
                    <td className="border border-gray-300 px-2 py-1.5 font-mono">{emp.id}<br/>{emp.nik || '-'}</td>
                    <td className="border border-gray-300 px-2 py-1.5 font-bold">{emp.name} <br/><span className="font-normal">{emp.phone || '-'}</span></td>
                    <td className="border border-gray-300 px-2 py-1.5 font-bold text-blue-700">{branch?.name || 'Head Office'}<br/><span className="font-normal text-gray-800">{dept?.name || '-'}</span></td>
                    <td className="border border-gray-300 px-2 py-1.5">{getFullAddress(emp)}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{emp.bankName || '-'}<br/>{emp.bankAccount || '-'}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}