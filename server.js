// Import modul yang diperlukan
const express = require('express');
const cors = require('cors'); // Middleware untuk mengatasi CORS
const mysql = require('mysql'); // Paket untuk koneksi MySQL
const bcrypt = require('bcrypt'); // Paket untuk hashing password
const multer = require('multer'); // Untuk mengunggah file
const path = require('path'); // Untuk manipulasi path
// Inisialisasi aplikasi Express
const app = express();

// Middleware CORS - mengizinkan semua origin
app.use(cors());

// Middleware untuk parsing JSON dalam permintaan
app.use(express.json());

// Konfigurasi penyimpanan multer untuk menyimpan file foto profil
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profile_photos'); // Tentukan folder penyimpanan
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Nama file unik
    }
});
const upload = multer({ storage: storage });


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

app.get('/menu', (req, res) => {
    const query = 'SELECT * FROM menu_items';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal mengambil data menu' });
        }
        res.json({ success: true, menu: results });
    });
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
        if (err || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }

        if (results.length > 0) {
            const user = results[0];
            console.log('User data from database:', user); // Logging untuk memastikan user data ada
            // Periksa password dengan bcrypt
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing password:', err);
                    res.status(500).json({ success: false, message: 'Internal server error' });
                } else if (isMatch) {
                    const token = Buffer.from(username).toString('base64');
                    console.log('User ID to be sent:', user.id); // Logging untuk memastikan user.id ada dan benar
                    res.json({ success: true, userId: user.id, role: user.role, token: token });
                } else {
                    res.status(401).json({ success: false, message: 'Unauthorized' });
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Unauthorized' });
        }
    });
});

app.get('/profile', (req, res) => {
    const userId = req.query.user_id;

    const query = 'SELECT * FROM profiles WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }
        res.json({ success: true, profile: results[0] });
    });
});

app.post('/edit-profile', upload.single('profile_photo'), (req, res) => {
    const { user_id, full_name, email, phone, address, bio } = req.body;
    let profilePhotoPath = req.file ? `/uploads/profile_photos/${req.file.filename}` : null;

    // Jika tidak ada foto baru yang diunggah, gunakan foto lama
    if (!profilePhotoPath) {
        const getPhotoQuery = 'SELECT profile_photo FROM profiles WHERE user_id = ?';
        db.query(getPhotoQuery, [user_id], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error retrieving profile photo' });
            }
            profilePhotoPath = results[0].profile_photo;
            updateProfile();
        });
    } else {
        updateProfile();
    }

    function updateProfile() {
        const query = `
            UPDATE profiles 
            SET full_name = ?, email = ?, phone = ?, address = ?, bio = ?, profile_photo = ?
            WHERE user_id = ?
        `;

        db.query(query, [full_name, email, phone, address, bio, profilePhotoPath, user_id], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error updating profile' });
            }
            res.json({ success: true, message: 'Profile updated successfully' });
        });
    }
});
// Middleware untuk membuat folder `uploads` dapat diakses secara publik
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Menjalankan server di port 3000
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
