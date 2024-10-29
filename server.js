// Import modul yang diperlukan
const express = require('express');
const cors = require('cors'); // Middleware untuk mengatasi CORS
const mysql = require('mysql'); // Paket untuk koneksi MySQL
const bcrypt = require('bcrypt'); // Paket untuk hashing password

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

// Endpoint untuk registrasi
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const role = 'customer'; // Set default role sebagai customer

    // Hash password sebelum menyimpannya ke database
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            res.status(500).json({ success: false, message: 'Error hashing password' });
            return;
        }

        // Query untuk menambahkan pengguna baru ke database
        const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
        db.query(query, [username, hashedPassword, role], (err, result) => {
            if (err) {
                console.error('Error inserting user:', err);
                res.status(500).json({ success: false, message: 'Gagal membuat akun' });
            } else {
                res.json({ success: true, message: 'Akun berhasil dibuat' });
            }
        });
    });
});

// Endpoint untuk login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query untuk mencari pengguna dengan username yang diberikan
    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
            return;
        }

        if (results.length > 0) {
            const user = results[0];
            // Periksa password dengan bcrypt
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing password:', err);
                    res.status(500).json({ success: false, message: 'Internal server error' });
                } else if (isMatch) {
                    res.json({ success: true, role: user.role });
                } else {
                    res.status(401).json({ success: false, message: 'Unauthorized' });
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Unauthorized' });
        }
    });
});

// Menjalankan server di port 3000
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
