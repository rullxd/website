// Import modul yang diperlukan
const express = require('express');
const cors = require('cors'); // Middleware untuk mengatasi CORS
const mysql = require('mysql'); // Paket untuk koneksi MySQL

// Inisialisasi aplikasi Express
const app = express();

// Middleware CORS - mengizinkan semua origin
app.use(cors());

// Middleware untuk parsing JSON dalam permintaan
app.use(express.json());

// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Ganti dengan username MySQL Anda
    password: 'Ramadani1410', // Ganti dengan password MySQL Anda
    database: 'login_app' // Nama database Anda
});

// Coba koneksi ke database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

// Endpoint untuk login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query untuk mencari pengguna dengan username dan password yang diberikan
    const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        } else {
            if (results.length > 0) {
                // Jika pengguna ditemukan
                const user = results[0];
                res.json({ success: true, role: user.role });
            } else {
                // Jika pengguna tidak ditemukan
                res.status(401).json({ success: false, message: 'Unauthorized' });
            }
        }
    });
});
// Endpoint untuk registrasi
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const role = 'customer'; // Set default role sebagai customer

    // Query untuk menambahkan pengguna baru ke database
    const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
    db.query(query, [username, password, role], (err, result) => {
        if (err) {
            console.error('Error inserting user:', err);
            res.status(500).json({ success: false, message: 'Gagal membuat akun' });
        } else {
            res.json({ success: true, message: 'Akun berhasil dibuat' });
        }
    });
});


// Menjalankan server di port 3000
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
