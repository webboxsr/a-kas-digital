const SUPABASE_URL = 'https://zmoqctknrbnjadrsmokm.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_LIilgHwRuMIbUfQMIs2g8Q_cNPQzrgH';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let appData = {
    users: [],
    activeUser: null,
    siswa: [],
    transaksi: [],
    settings: {
        nominalKas: 10000,
        periode: 'Mingguan',
        theme: 'light'
    }
};

let navigationHistory = [];

async function initApp() {
    await loadData();
    applyTheme();
    if (appData.activeUser) {
        showMainApp();
        setupRealtime();
    } else {
        showAuthScreen();
    }
}

async function loadData() {
    
    const { data: users } = await supabaseClient.from('users').select('*');
    if (users) appData.users = users;

    const { data: siswa } = await supabaseClient.from('siswa').select('*');
    if (siswa) appData.siswa = siswa;

    const { data: transaksi } = await supabaseClient.from('transaksi').select('*');
    if (transaksi) appData.transaksi = transaksi;

    const { data: settings } = await supabaseClient.from('settings').select('*').single();
    if (settings) appData.settings = settings;

    const storedActive = localStorage.getItem('kas_active_user');
    if (storedActive) appData.activeUser = JSON.parse(storedActive);
}

function saveData() {
    localStorage.setItem('kas_users', JSON.stringify(appData.users));
    localStorage.setItem('kas_active_user', JSON.stringify(appData.activeUser));
    localStorage.setItem('kas_siswa', JSON.stringify(appData.siswa));
    localStorage.setItem('kas_transaksi', JSON.stringify(appData.transaksi));
    localStorage.setItem('kas_settings', JSON.stringify(appData.settings));
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', appData.settings.theme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = appData.settings.theme === 'dark';
    }
}

function toggleTheme() {
    appData.settings.theme = appData.settings.theme === 'dark' ? 'light' : 'dark';
    saveData();
    applyTheme();
}

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    if (appData.users.length > 0) {
        switchAuthMode('login');
    } else {
        switchAuthMode('register');
    }
}

function switchAuthMode(mode) {
    const title = document.getElementById('auth-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const form = document.getElementById('auth-form');
    form.dataset.mode = mode;

    if (mode === 'login') {
        title.innerText = 'Masuk Kembali';
        submitBtn.innerText = 'Masuk';
        switchText.innerHTML = 'Belum punya akun? <a href="#" onclick="switchAuthMode(\'register\')">Buat Akun</a>';
    } else {
        title.innerText = 'Buat Akun';
        submitBtn.innerText = 'Daftar';
        switchText.innerHTML = 'Sudah punya akun? <a href="#" onclick="switchAuthMode(\'login\')">Masuk</a>';
    }
    handleRoleChange();
}

function handleRoleChange() {
    const role = document.getElementById('auth-role').value;
    const adminGroup = document.getElementById('admin-position-group');
    if (role === 'Admin') {
        const takenPositions = appData.users.filter(u => u.role === 'Admin').map(u => u.adminPosition);
        if (takenPositions.length >= 3) {
            alert('Semua posisi Admin sudah terisi. Anda otomatis terdaftar sebagai Siswa.');
            document.getElementById('auth-role').value = 'Siswa';
            adminGroup.style.display = 'none';
            return;
        }
        adminGroup.style.display = 'block';
        const selectPos = document.getElementById('auth-admin-position');
        Array.from(selectPos.options).forEach(opt => {
            opt.disabled = takenPositions.includes(opt.value);
        });
    } else {
        adminGroup.style.display = 'none';
    }
}

document.getElementById('auth-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const mode = this.dataset.mode || 'register';
    const fullname = document.getElementById('auth-fullname').value.trim();
    const nickname = document.getElementById('auth-nickname').value.trim();
    const password = document.getElementById('auth-password').value;
    const role = document.getElementById('auth-role').value;
    const adminPosition = role === 'Admin' ? document.getElementById('auth-admin-position').value : null;

    if (!fullname || !password) {
        alert('Mohon isi semua field wajib.');
        return;
    }

    if (mode === 'register') {
        const { data: existing } = await supabaseClient
            .from('users')
            .select('*')
            .eq('fullname', fullname)
            .maybeSingle();

        if (existing) {
            alert('Nama lengkap sudah terdaftar.');
            return;
        }

        const { data: newUser, error } = await supabaseClient
            .from('users')
            .insert([{ fullname, nickname, password, role, admin_position: adminPosition }])
            .select()
            .single();

        if (error) {
            alert('Gagal mendaftar: ' + error.message);
            return;
        }

        appData.activeUser = newUser;
        localStorage.setItem('kas_active_user', JSON.stringify(newUser));
        showMainApp();

    } else {
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('fullname', fullname)
            .eq('password', password)
            .eq('role', role)
            .maybeSingle();

        if (error || !user) {
            alert('Nama, password, atau role tidak sesuai.');
            return;
        }

        appData.activeUser = user;
        localStorage.setItem('kas_active_user', JSON.stringify(user));
        showMainApp();
    }
});

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = 'Sembunyikan';
    } else {
        input.type = 'password';
        btn.innerText = 'Lihat';
    }
}

function showMainApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    
    document.getElementById('user-display-name').innerText = appData.activeUser.nickname || appData.activeUser.fullname;
    const roleBadge = document.getElementById('user-display-role');
    roleBadge.innerText = appData.activeUser.role === 'Admin' ? appData.activeUser.adminPosition : 'Siswa';
    roleBadge.className = `badge ${appData.activeUser.role === 'Admin' ? 'badge-danger' : 'badge-info'}`;

    renderNavigation();
    applyPermissions();
    navigateTo('dashboard', false);
}

function renderNavigation() {
    const navMenu = document.getElementById('nav-menu');
    const bottomNav = document.getElementById('bottom-nav');
    navMenu.innerHTML = '';
    bottomNav.innerHTML = '';

    let items = [];
    if (appData.activeUser.role === 'Admin') {
        items = [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'siswa', label: 'Data Siswa' },
            { id: 'kas', label: 'Kas Kelas' },
            { id: 'transaksi', label: 'Transaksi' },
            { id: 'tagihan', label: 'Tagihan' },
            { id: 'laporan', label: 'Laporan' },
            { id: 'profil', label: 'Profil' },
            { id: 'pengaturan', label: 'Pengaturan' }
        ];
    } else {
        items = [
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'pembayaran-saya', label: 'Pembayaran Saya' },
            { id: 'riwayat', label: 'Riwayat' },
            { id: 'kas', label: 'Informasi Kas' },
            { id: 'profil', label: 'Profil' },
            { id: 'pengaturan', label: 'Pengaturan' }
        ];
    }

    items.forEach(item => {
        const a = document.createElement('a');
        a.className = 'nav-item';
        a.innerText = item.label;
        a.onclick = () => navigateTo(item.id);
        a.dataset.page = item.id;
        navMenu.appendChild(a);

        const b = document.createElement('div');
        b.className = 'bottom-nav-item';
        b.innerText = item.label;
        b.onclick = () => navigateTo(item.id);
        b.dataset.page = item.id;
        bottomNav.appendChild(b);
    });
}

function applyPermissions() {
    const isAdmin = appData.activeUser.role === 'Admin';
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
}

function navigateTo(pageId, recordHistory = true) {
    if (recordHistory) {
        const currentActive = document.querySelector('.page-section:not([style*="display: none"])');
        if (currentActive && currentActive.id.replace('page-', '') !== pageId) {
            navigationHistory.push(currentActive.id.replace('page-', ''));
        }
    }

    document.querySelectorAll('.page-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));

    let targetPage = pageId;
    if (pageId === 'pembayaran-saya') targetPage = 'tagihan';

    const pageElement = document.getElementById(`page-${targetPage}`);
    if (pageElement) {
        pageElement.style.display = 'flex';
    }

    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    const bottomItem = document.querySelector(`.bottom-nav-item[data-page="${pageId}"]`);
    if (bottomItem) {
        bottomItem.classList.add('active');
        bottomItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    refreshPageData(targetPage);
}

function goBack() {
    if (navigationHistory.length > 0) {
        const previousPage = navigationHistory.pop();
        navigateTo(previousPage, false);
    } else {
        alert('Tidak ada halaman sebelumnya.');
    }
}

function refreshPageData(pageId) {
    if (pageId === 'dashboard') renderDashboard();
    if (pageId === 'siswa') renderSiswa();
    if (pageId === 'kas') renderKas();
    if (pageId === 'transaksi') renderTransaksi();
    if (pageId === 'tagihan') renderTagihan();
    if (pageId === 'laporan') renderLaporan();
    if (pageId === 'riwayat') renderRiwayat();
    if (pageId === 'profil') renderProfil();
    if (pageId === 'pengaturan') renderPengaturan();
}

function formatRupiah(amount) {
    return 'Rp' + Number(amount).toLocaleString('id-ID');
}

function calculateTotals() {
    let totalPemasukan = 0;
    let totalPengeluaran = 0;

    appData.transaksi.forEach(t => {
        if (t.type === 'Pemasukan') totalPemasukan += Number(t.nominal);
        if (t.type === 'Pengeluaran') totalPengeluaran += Number(t.nominal);
    });

    const saldo = totalPemasukan - totalPengeluaran;
    return { totalPemasukan, totalPengeluaran, saldo };
}

function calculateSiswaKas(siswaId) {
    let totalDibayar = 0;
    appData.transaksi.forEach(t => {
        if (t.type === 'Pemasukan' && t.siswaId == siswaId) {
            totalDibayar += Number(t.nominal);
        }
    });
    const totalTagihan = appData.settings.nominalKas;
    const tunggakan = Math.max(0, totalTagihan - totalDibayar);
    
    let status = 'Belum Bayar';
    if (totalDibayar >= totalTagihan) {
        status = 'Sudah Bayar';
    } else if (totalDibayar > 0) {
        status = 'Sebagian';
    }
    if (tunggakan > 0 && totalDibayar < totalTagihan) {
        status = 'Menunggak';
    }

    return { totalDibayar, totalTagihan, tunggakan, status };
}

function renderDashboard() {
    const cardsContainer = document.getElementById('dashboard-cards');
    const { totalPemasukan, totalPengeluaran, saldo } = calculateTotals();
    
    let totalTunggakan = 0;
    let sudahBayarCount = 0;
    let belumBayarCount = 0;

    appData.siswa.forEach(s => {
        const stats = calculateSiswaKas(s.id);
        totalTunggakan += stats.tunggakan;
        if (stats.status === 'Sudah Bayar') sudahBayarCount++;
        else belumBayarCount++;
    });

    if (appData.activeUser.role === 'Admin') {
        cardsContainer.innerHTML = `
            <div class="card"><h4>Saldo Kas</h4><p class="amount text-primary">${formatRupiah(saldo)}</p></div>
            <div class="card"><h4>Total Pemasukan</h4><p class="amount text-success">${formatRupiah(totalPemasukan)}</p></div>
            <div class="card"><h4>Total Pengeluaran</h4><p class="amount text-danger">${formatRupiah(totalPengeluaran)}</p></div>
            <div class="card"><h4>Total Tunggakan</h4><p class="amount text-warning">${formatRupiah(totalTunggakan)}</p></div>
            <div class="card"><h4>Jumlah Siswa</h4><p class="amount">${appData.siswa.length}</p></div>
            <div class="card"><h4>Sudah Bayar</h4><p class="amount text-success">${sudahBayarCount}</p></div>
            <div class="card"><h4>Belum Bayar</h4><p class="amount text-danger">${belumBayarCount}</p></div>
        `;
        document.getElementById('dashboard-unpaid-card').style.display = 'block';
    } else {
        const mySiswa = appData.siswa.find(s => s.fullname.toLowerCase() === appData.activeUser.fullname.toLowerCase());
        const myStats = mySiswa ? calculateSiswaKas(mySiswa.id) : { totalDibayar: 0, tunggakan: 0, status: 'Belum Ada Data' };

        cardsContainer.innerHTML = `
            <div class="card"><h4>Status Saya</h4><p class="amount text-primary">${myStats.status}</p></div>
            <div class="card"><h4>Total Pembayaran Saya</h4><p class="amount text-success">${formatRupiah(myStats.totalDibayar)}</p></div>
            <div class="card"><h4>Tunggakan Saya</h4><p class="amount text-danger">${formatRupiah(myStats.tunggakan)}</p></div>
            <div class="card"><h4>Saldo Kas Kelas</h4><p class="amount text-primary">${formatRupiah(saldo)}</p></div>
            <div class="card"><h4>Pemasukan Kelas</h4><p class="amount text-success">${formatRupiah(totalPemasukan)}</p></div>
            <div class="card"><h4>Pengeluaran Kelas</h4><p class="amount text-danger">${formatRupiah(totalPengeluaran)}</p></div>
        `;
        document.getElementById('dashboard-unpaid-card').style.display = 'none';
    }

    const recentTx = appData.transaksi.slice(-5).reverse();
    const recentTxContainer = document.getElementById('dashboard-recent-transactions');
    if (recentTx.length === 0) {
        recentTxContainer.innerHTML = '<p class="empty-state">Belum ada transaksi.</p>';
    } else {
        let html = '<table class="data-table"><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Nominal</th></tr></thead><tbody>';
        recentTx.forEach(t => {
            html += `<tr><td>${t.tanggal}</td><td>${t.keterangan || t.kategori}</td><td class="${t.type === 'Pemasukan' ? 'text-success' : 'text-danger'}">${formatRupiah(t.nominal)}</td></tr>`;
        });
        html += '</tbody></table>';
        recentTxContainer.innerHTML = html;
    }

    if (appData.activeUser.role === 'Admin') {
        const unpaidContainer = document.getElementById('dashboard-unpaid-students');
        const unpaidSiswa = appData.siswa.filter(s => calculateSiswaKas(s.id).status !== 'Sudah Bayar');
        if (unpaidSiswa.length === 0) {
            unpaidContainer.innerHTML = '<p class="empty-state">Semua siswa sudah membayar.</p>';
        } else {
            let html = '<table class="data-table"><thead><tr><th>Nama</th><th>Tunggakan</th></tr></thead><tbody>';
            unpaidSiswa.forEach(s => {
                const stats = calculateSiswaKas(s.id);
                html += `<tr><td>${s.fullname}</td><td class="text-danger">${formatRupiah(stats.tunggakan)}</td></tr>`;
            });
            html += '</tbody></table>';
            unpaidContainer.innerHTML = html;
        }
    }
}

function renderSiswa() {
    const tbody = document.getElementById('tbody-siswa');
    const search = document.getElementById('search-siswa').value.toLowerCase();
    tbody.innerHTML = '';

    const filtered = appData.siswa.filter(s => s.fullname.toLowerCase().includes(search) || s.nickname.toLowerCase().includes(search));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data siswa.</td></tr>';
        return;
    }

    filtered.sort((a, b) => a.absen - b.absen).forEach(s => {
        const stats = calculateSiswaKas(s.id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.absen}</td>
            <td>${s.fullname}</td>
            <td>${s.nickname}</td>
            <td>${formatRupiah(stats.totalDibayar)}</td>
            <td>${formatRupiah(stats.tunggakan)}</td>
            <td><span class="badge ${stats.status === 'Sudah Bayar' ? 'badge-success' : 'badge-danger'}">${stats.status}</span></td>
            <td class="admin-only">
                <button class="btn btn-sm btn-secondary" onclick="editSiswa(${s.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSiswa(${s.id})">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    applyPermissions();
}

document.getElementById('form-siswa').addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = document.getElementById('siswa-id').value;
    const absen = parseInt(document.getElementById('siswa-absen').value);
    const fullname = document.getElementById('siswa-fullname').value.trim();
    const nickname = document.getElementById('siswa-nickname').value.trim();

    if (id) {
        const { error } = await supabaseClient
            .from('siswa')
            .update({ absen, fullname, nickname })
            .eq('id', id);
        
        if (error) { alert('Gagal edit siswa: ' + error.message); return; }
        const index = appData.siswa.findIndex(s => s.id == id);
        if (index !== -1) appData.siswa[index] = { ...appData.siswa[index], absen, fullname, nickname };
        
    } else {
        const { data, error } = await supabaseClient
            .from('siswa')
            .insert([{ absen, fullname, nickname }])
            .select();
            
        if (error) { alert('Gagal tambah siswa: ' + error.message); return; }
        appData.siswa.push(data[0]);
    }

    closeModal('modal-siswa');
    renderSiswa();
});

function editSiswa(id) {
    const s = appData.siswa.find(item => item.id == id);
    if (s) {
        document.getElementById('siswa-id').value = s.id;
        document.getElementById('siswa-absen').value = s.absen;
        document.getElementById('siswa-fullname').value = s.fullname;
        document.getElementById('siswa-nickname').value = s.nickname;
        document.getElementById('modal-siswa-title').innerText = 'Edit Siswa';
        openModal('modal-siswa');
    }
}

async function deleteSiswa(id) {
    if (confirm('Yakin ingin menghapus siswa ini?')) {
        const { error } = await supabaseClient
            .from('siswa')
            .delete()
            .eq('id', id);
            
        if (error) { alert('Gagal hapus siswa: ' + error.message); return; }
        appData.siswa = appData.siswa.filter(s => s.id != id);
        renderSiswa();
    }
}

function renderKas() {
    const { totalPemasukan, totalPengeluaran, saldo } = calculateTotals();
    document.getElementById('kas-total-pemasukan').innerText = formatRupiah(totalPemasukan);
    document.getElementById('kas-total-pengeluaran').innerText = formatRupiah(totalPengeluaran);
    document.getElementById('kas-saldo').innerText = formatRupiah(saldo);

    const selectSiswa = document.getElementById('pembayaran-siswa-id');
    selectSiswa.innerHTML = '';
    appData.siswa.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.innerText = `${s.absen}. ${s.fullname}`;
        selectSiswa.appendChild(opt);
    });
}

document.getElementById('form-pembayaran').addEventListener('submit', async function(e) {
    e.preventDefault();
    const siswaId = document.getElementById('pembayaran-siswa-id').value;
    const tanggal = document.getElementById('pembayaran-tanggal').value;
    const nominal = parseFloat(document.getElementById('pembayaran-nominal').value);

    const siswa = appData.siswa.find(s => s.id == siswaId);
    if (!siswa || !nominal || nominal <= 0) return;
    const { data, error } = await supabaseClient
        .from('transaksi')
        .insert([{
            type: 'Pemasukan',
            kategori: 'Pembayaran Kas',
            siswa_id: siswa.id,
            sumber: siswa.fullname,
            nominal: nominal,
            tanggal: tanggal,
            keterangan: `Kas a.n ${siswa.fullname}`,
            bukti: ''
        }])
        .select();

    if (error) { alert('Gagal menyimpan pembayaran: ' + error.message); return; }

    appData.transaksi.push(data[0]);
    closeModal('modal-pembayaran');
    renderKas();
    alert('Pembayaran berhasil dicatat!');
});

function renderTransaksi() {
    const tbody = document.getElementById('tbody-transaksi');
    tbody.innerHTML = '';

    if (appData.transaksi.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada transaksi.</td></tr>';
        return;
    }

    appData.transaksi.slice().reverse().forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.tanggal}</td>
            <td><span class="badge ${t.type === 'Pemasukan' ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
            <td>${t.kategori || t.sumber || t.nama}</td>
            <td>${formatRupiah(t.nominal)}</td>
            <td>${t.keterangan || '-'}</td>
            <td>${t.bukti ? `<button class="btn btn-sm btn-info" onclick="viewBukti('${t.id}')">Lihat</button>` : '-'}</td>
            <td class="admin-only">
                <button class="btn btn-sm btn-danger" onclick="deleteTransaksi(${t.id})">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    applyPermissions();
}

document.getElementById('form-pemasukan').addEventListener('submit', async function(e) {
    e.preventDefault();
    const sumber = document.getElementById('pemasukan-sumber').value.trim();
    const tanggal = document.getElementById('pemasukan-tanggal').value;
    const nominal = parseFloat(document.getElementById('pemasukan-nominal').value);
    const keterangan = document.getElementById('pemasukan-keterangan').value.trim();
    const fileInput = document.getElementById('pemasukan-bukti');

    if (!sumber || !nominal || nominal <= 0) return;

    let buktiUrl = '';
    if (fileInput.files && fileInput.files[0]) {
        buktiUrl = await uploadBuktiTransaksi(fileInput.files[0]);
    }

    const { data, error } = await supabaseClient
        .from('transaksi')
        .insert([{
            type: 'Pemasukan',
            kategori: 'Pemasukan Lainnya',
            sumber, nominal, tanggal, keterangan,
            bukti: buktiUrl
        }])
        .select();

    if (error) { alert('Gagal menyimpan: ' + error.message); return; }

    appData.transaksi.push(data[0]);
    closeModal('modal-pemasukan');
    renderTransaksi();
    e.target.reset();
});

document.getElementById('form-pengeluaran').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nama = document.getElementById('pengeluaran-nama').value.trim();
    const tanggal = document.getElementById('pengeluaran-tanggal').value;
    const nominal = parseFloat(document.getElementById('pengeluaran-nominal').value);
    const keterangan = document.getElementById('pengeluaran-keterangan').value.trim();
    const fileInput = document.getElementById('pengeluaran-bukti');

    if (!nama || !nominal || nominal <= 0) return;

    let buktiUrl = '';
    if (fileInput.files && fileInput.files[0]) {
        buktiUrl = await uploadBuktiTransaksi(fileInput.files[0]);
    }

    const { data, error } = await supabaseClient
        .from('transaksi')
        .insert([{
            type: 'Pengeluaran',
            kategori: 'Pengeluaran',
            nama, nominal, tanggal, keterangan,
            bukti: buktiUrl
        }])
        .select();

    if (error) { alert('Gagal menyimpan: ' + error.message); return; }

    appData.transaksi.push(data[0]);
    closeModal('modal-pengeluaran');
    renderTransaksi();
    e.target.reset();
});

async function deleteTransaksi(id) {
    if (confirm('Yakin ingin menghapus transaksi ini?')) {
        const { error } = await supabaseClient
            .from('transaksi')
            .delete()
            .eq('id', id);

        if (error) { alert('Gagal hapus transaksi: ' + error.message); return; }

        appData.transaksi = appData.transaksi.filter(t => t.id != id);
        renderTransaksi();
    }
}

function viewBukti(id) {
    const t = appData.transaksi.find(item => item.id == id);
    if (t && t.bukti) {
        document.getElementById('bukti-image-display').src = t.bukti;
        openModal('modal-bukti');
    }
}

function renderTagihan() {
    const tbody = document.getElementById('tbody-tagihan');
    tbody.innerHTML = '';

    let listSiswa = appData.siswa;
    if (appData.activeUser.role !== 'Admin') {
        listSiswa = appData.siswa.filter(s => s.fullname.toLowerCase() === appData.activeUser.fullname.toLowerCase());
    }

    if (listSiswa.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada data tagihan.</td></tr>';
        return;
    }

    listSiswa.forEach(s => {
        const stats = calculateSiswaKas(s.id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.fullname}</td>
            <td>${formatRupiah(stats.totalTagihan)}</td>
            <td>${formatRupiah(stats.totalDibayar)}</td>
            <td>${formatRupiah(stats.tunggakan)}</td>
            <td><span class="badge ${stats.status === 'Sudah Bayar' ? 'badge-success' : 'badge-danger'}">${stats.status}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="copyTagihanText('${s.fullname}', ${stats.totalTagihan}, ${stats.totalDibayar}, ${stats.tunggakan}, '${stats.status}')">Salin Rincian</button>
                <button class="btn btn-sm btn-success" onclick="shareWhatsApp('${s.fullname}', ${stats.totalTagihan}, ${stats.totalDibayar}, ${stats.tunggakan}, '${stats.status}')">WA</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function generateTagihanText(nama, total, dibayar, tunggakan, status) {
    return `*RINCIAN TAGIHAN KAS KELAS*\n` +
           `Nama: ${nama}\n` +
           `Total Tagihan: ${formatRupiah(total)}\n` +
           `Sudah Dibayar: ${formatRupiah(dibayar)}\n` +
           `Tunggakan: ${formatRupiah(tunggakan)}\n` +
           `Status: ${status}`;
}

function copyTagihanText(nama, total, dibayar, tunggakan, status) {
    const text = generateTagihanText(nama, total, dibayar, tunggakan, status);
    navigator.clipboard.writeText(text).then(() => {
        alert('Rincian tagihan berhasil disalin.');
    });
}

function shareWhatsApp(nama, total, dibayar, tunggakan, status) {
    const text = generateTagihanText(nama, total, dibayar, tunggakan, status);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function renderLaporan() {
    const { totalPemasukan, totalPengeluaran, saldo } = calculateTotals();
    document.getElementById('lap-pemasukan').innerText = formatRupiah(totalPemasukan);
    document.getElementById('lap-pengeluaran').innerText = formatRupiah(totalPengeluaran);
    document.getElementById('lap-saldo').innerText = formatRupiah(saldo);

    const tbody = document.getElementById('tbody-laporan');
    tbody.innerHTML = '';

    if (appData.transaksi.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada transaksi.</td></tr>';
        return;
    }

    appData.transaksi.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.tanggal}</td>
            <td>${t.type}</td>
            <td>${t.keterangan || t.kategori || t.nama || '-'}</td>
            <td class="${t.type === 'Pemasukan' ? 'text-success' : 'text-danger'}">${formatRupiah(t.nominal)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Laporan Keuangan Kas Kelas', 10, 10);
    
    let y = 20;
    appData.transaksi.forEach((t, i) => {
        doc.text(`${i + 1}. ${t.tanggal} | ${t.type} | ${t.keterangan || '-'} | Rp${t.nominal}`, 10, y);
        y += 10;
    });
    doc.save('Laporan-Kas-Kelas.pdf');
}

function exportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(appData.transaksi);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaksi");
    XLSX.writeFile(workbook, "Laporan-Kas-Kelas.xlsx");
}

function renderRiwayat() {
    const tbody = document.getElementById('tbody-riwayat');
    const search = document.getElementById('filter-riwayat-search').value.toLowerCase();
    const type = document.getElementById('filter-riwayat-type').value;
    const date = document.getElementById('filter-riwayat-date').value;

    tbody.innerHTML = '';

    let filtered = appData.transaksi.filter(t => {
        const matchesSearch = (t.keterangan || '').toLowerCase().includes(search) || (t.sumber || '').toLowerCase().includes(search) || (t.nama || '').toLowerCase().includes(search);
        const matchesType = type ? t.type === type : true;
        const matchesDate = date ? t.tanggal === date : true;
        return matchesSearch && matchesType && matchesDate;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Data riwayat tidak ditemukan.</td></tr>';
        return;
    }

    filtered.slice().reverse().forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.tanggal}</td>
            <td><span class="badge ${t.type === 'Pemasukan' ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
            <td>${t.keterangan || t.kategori || t.nama || '-'}</td>
            <td>${formatRupiah(t.nominal)}</td>
            <td>${t.bukti ? `<button class="btn btn-sm btn-info" onclick="viewBukti('${t.id}')">Lihat</button>` : '-'}</td>
            <td class="admin-only">
                <button class="btn btn-sm btn-danger" onclick="deleteTransaksi(${t.id})">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    applyPermissions();
}

function resetFilterRiwayat() {
    document.getElementById('filter-riwayat-search').value = '';
    document.getElementById('filter-riwayat-type').value = '';
    document.getElementById('filter-riwayat-date').value = '';
    renderRiwayat();
}

function renderProfil() {
    document.getElementById('profile-fullname').value = appData.activeUser.fullname;
    document.getElementById('profile-nickname').value = appData.activeUser.nickname;
    document.getElementById('profile-password').value = '';
    
    if (appData.activeUser.photo) {
        document.getElementById('profile-avatar').src = appData.activeUser.photo;
    }
}

async function uploadProfilePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const avatarImg = document.getElementById('profile-avatar');
    avatarImg.style.opacity = '0.5';

    const ext = file.name.split('.').pop();
    const fileName = `profile-${appData.activeUser.id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabaseClient.storage
        .from('kas-files')
        .upload(fileName, file, { upsert: true });

    if (uploadErr) {
        alert('Gagal upload foto: ' + uploadErr.message);
        avatarImg.style.opacity = '1';
        return;
    }

    const { data: urlData } = supabaseClient.storage
        .from('kas-files')
        .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    const { error: dbErr } = await supabaseClient
        .from('users')
        .update({ photo: publicUrl })
        .eq('id', appData.activeUser.id);

    if (dbErr) {
        alert('Gagal simpan URL foto: ' + dbErr.message);
        avatarImg.style.opacity = '1';
        return;
    }

    appData.activeUser.photo = publicUrl;
    localStorage.setItem('kas_active_user', JSON.stringify(appData.activeUser));
    avatarImg.src = publicUrl;
    avatarImg.style.opacity = '1';

    alert('Foto profil berhasil diperbarui!');
}

document.getElementById('profile-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const fullname = document.getElementById('profile-fullname').value.trim();
    const nickname = document.getElementById('profile-nickname').value.trim();
    const password = document.getElementById('profile-password').value;

    if (!fullname || !nickname) return;

    appData.activeUser.fullname = fullname;
    appData.activeUser.nickname = nickname;
    if (password) {
        appData.activeUser.password = password;
    }

    updateActiveUserData();
    alert('Profil berhasil diperbarui.');
    showMainApp();
});

function updateActiveUserData() {
    const index = appData.users.findIndex(u => u.id === appData.activeUser.id);
    if (index !== -1) {
        appData.users[index] = appData.activeUser;
    }
    saveData();
}

function renderPengaturan() {
    document.getElementById('setting-kas-nominal').value = appData.settings.nominalKas;
    document.getElementById('setting-kas-periode').value = appData.settings.periode;
}

document.getElementById('setting-kas-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const nominal = parseFloat(document.getElementById('setting-kas-nominal').value);
    const periode = document.getElementById('setting-kas-periode').value;

    if (nominal >= 0) {
        appData.settings.nominalKas = nominal;
        appData.settings.periode = periode;
        saveData();
        alert('Pengaturan kas berhasil disimpan.');
    }
});

function switchAccount() {
    appData.activeUser = null;
    saveData();
    showAuthScreen();
}

function logout() {
    appData.activeUser = null;
    localStorage.removeItem('kas_active_user');
    showAuthScreen();
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

document.addEventListener('DOMContentLoaded', initApp);

function setupRealtime() {
    supabaseClient
        .channel('transaksi-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'transaksi' }, 
            async (payload) => {
                console.log('Transaksi berubah:', payload);
                const { data } = await supabaseClient.from('transaksi').select('*');
                if (data) appData.transaksi = data;
                refreshCurrentPage();
            }
        )

        .subscribe();
    supabaseClient
        .channel('siswa-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'siswa' }, 
            async (payload) => {
                console.log('Siswa berubah:', payload);
                const { data } = await supabaseClient.from('siswa').select('*');
                if (data) appData.siswa = data;
                refreshCurrentPage();
            }
        )
        .subscribe();

    supabaseClient
        .channel('settings-changes')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'settings' }, 
            async (payload) => {
                console.log('Settings berubah:', payload);
                const { data } = await supabaseClient.from('settings').select('*').single();
                if (data) appData.settings = data;
                refreshCurrentPage();
            }
        )
        .subscribe();
}

function refreshCurrentPage() {
    const activePage = document.querySelector('.page-section:not([style*="display: none"])');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        refreshPageData(pageId);
    }
}

async function uploadBuktiTransaksi(file) {
    if (!file) return '';
    const ext = file.name.split('.').pop();
    const fileName = `bukti-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabaseClient.storage
        .from('kas-files')
        .upload(fileName, file);

    if (error) {
        console.error('Upload error:', error);
        return '';
    }

    const { data } = supabaseClient.storage
        .from('kas-files')
        .getPublicUrl(fileName);

    return data.publicUrl;
}
