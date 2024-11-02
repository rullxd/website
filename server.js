// Import modul yang diperlukan
const express = require('express');
const cors = require('cors'); // Middleware untuk mengatasi CORS
const mysql = require('mysql'); // Paket untuk koneksi MySQL
const bcrypt = require('bcrypt'); // Paket untuk hashing password
const multer = require('multer'); // Untuk mengunggah file
const path = require('path'); // Untuk manipulasi path
const nodemailer = require('nodemailer');
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


app.get('/menu', (req, res) => {
    const query = 'SELECT * FROM menu_items';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal mengambil data menu' });
        }
        res.json({ success: true, menu: results });
    });
});

// Endpoint untuk menambah menu baru
app.post('/menu/add', (req, res) => {
    const { name, category, description, price, image_url } = req.body;

    const query = 'INSERT INTO menu_items (name, category, description, price, image_url) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name, category, description, price, image_url], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal menambahkan menu' });
        }
        res.json({ success: true, message: 'Menu berhasil ditambahkan' });
    });
});
// Endpoint untuk menghapus menu
app.delete('/menu/:id', (req, res) => {
    const menuId = req.params.id;
    const query = 'DELETE FROM menu_items WHERE id = ?';

    db.query(query, [menuId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal menghapus menu' });
        }
        res.json({ success: true, message: 'Menu berhasil dihapus' });
    });
});

// Endpoint untuk mengupdate menu yang ada
// Endpoint untuk mendapatkan data satu item menu berdasarkan ID
app.get('/menu/:id', (req, res) => {
    const menuId = req.params.id;
    const query = 'SELECT * FROM menu_items WHERE id = ?';

    db.query(query, [menuId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal mengambil data menu' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
        }
        res.json({ success: true, menu: results[0] });
    });
});
app.put('/menu/edit/:id', (req, res) => {
    const menuId = req.params.id;
    const { name, category, description, price, image_url } = req.body;

    const query = `
        UPDATE menu_items 
        SET name = ?, category = ?, description = ?, price = ?, image_url = ?
        WHERE id = ?
    `;

    db.query(query, [name, category, description, price, image_url, menuId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal mengupdate menu' });
        }
        res.json({ success: true, message: 'Menu berhasil diupdate' });
    });
});





// Endpoint untuk registrasi
app.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    const role = 'customer'; // Set default role sebagai customer

    // Hash password sebelum menyimpannya ke database
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            res.status(500).json({ success: false, message: 'Error hashing password' });
            return;
        }

        // Jika registrasi berhasil, hapus data dari temp_users
        const deleteQuery = 'DELETE FROM temp_users WHERE email = ?';
        db.query(deleteQuery, [email], (deleteErr, deleteResult) => {
            if (deleteErr) {
                console.error('Error deleting temp user:', deleteErr);
                return res.status(500).json({ success: false, message: 'Registrasi berhasil, tetapi gagal menghapus data sementara' });
            }
            res.json({ success: true, message: 'Akun berhasil dibuat dan data sementara dihapus' });
        });
    });
});

let verificationCode = Math.floor(100000 + Math.random() * 900000); // Kode 6 digit acak

// Konfigurasi transporter Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sahtulbb@gmail.com',      // Ganti dengan email Anda
        pass: 'wzjw totv zqxw uzfm'          // Ganti dengan password aplikasi atau kata sandi
    }
});

// Endpoint untuk mengirim kode verifikasi
app.post('/sendVerificationCode', (req, res) => {
    const { email } = req.body;
    const verificationCode = Math.floor(100000 + Math.random() * 900000); // Menghasilkan kode verifikasi 6 digit

    // Cek apakah email sudah ada di temp_users
    const checkQuery = 'SELECT * FROM temp_users WHERE email = ?';
    db.query(checkQuery, [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Gagal memeriksa email' });
        }

        if (results.length > 0) {
            // Jika email sudah ada, update kode verifikasi
            const updateQuery = 'UPDATE temp_users SET verification_code = ? WHERE email = ?';
            db.query(updateQuery, [verificationCode, email], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Gagal memperbarui kode verifikasi' });
                }
                sendVerificationEmail(email, verificationCode, res); // Fungsi untuk mengirim email
            });
        } else {
            // Jika email belum ada, insert data baru
            const insertQuery = 'INSERT INTO temp_users (email, verification_code) VALUES (?, ?)';
            db.query(insertQuery, [email, verificationCode], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Gagal menyimpan data' });
                }
                sendVerificationEmail(email, verificationCode, res); // Fungsi untuk mengirim email
            });
        }
    });
});
// Fungsi untuk mengirim email verifikasi
function sendVerificationEmail(email, verificationCode, res) {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Verifikasi Akun Anda - Kode Registrasi',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                <h2 style="color: #007bff;">Selamat Datang di Aplikasi Kami!</h2>
                <p>Halo,</p>
                <p>Terima kasih telah mendaftar. Untuk menyelesaikan proses registrasi, mohon masukkan kode verifikasi berikut:</p>
                <h3 style="color: #007bff; text-align: center;">${verificationCode}</h3>
                <p>Masukkan kode ini di halaman registrasi untuk memverifikasi akun Anda. Kode ini berlaku selama 10 menit.</p>
                <p>Jika Anda tidak merasa mendaftar di aplikasi ini, abaikan saja email ini.</p>
                <br>
                <p>Salam hangat,<br>Tim Registrasi Kami</p>
                <hr>
                <small style="color: #555;">Email ini dikirim secara otomatis, mohon tidak membalas langsung.</small>
            </div>
        `
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: 'Gagal mengirim email' });
        }
        console.log('Email terkirim: ' + info.response);
        res.json({ success: true, message: 'Kode verifikasi terkirim' });
    });
}


app.post('/verifyCode', (req, res) => {
    const { email, verificationCode } = req.body;

    // Query ke database untuk mengambil kode verifikasi berdasarkan email
    const query = 'SELECT verification_code FROM temp_users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
        }

        if (results.length === 0) {
            return res.json({ success: false, message: 'Email tidak ditemukan di database.' });
        }

        // Ambil kode verifikasi dari hasil query dan bandingkan
        const storedCode = results[0].verification_code;
        if (storedCode === verificationCode) {
            res.json({ success: true, message: 'Kode verifikasi sesuai' });
        } else {
            res.json({ success: false, message: 'Kode verifikasi salah atau tidak valid.' });
        }
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

            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing password:', err);
                    res.status(500).json({ success: false, message: 'Internal server error' });
                } else if (isMatch) {
                    const token = Buffer.from(username).toString('base64');

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

app.post('/cart/add', (req, res) => {
    const { user_id, menu_item_name, quantity, price, image_url } = req.body;

    // Cek apakah item sudah ada di keranjang user
    const checkQuery = 'SELECT * FROM cart_items WHERE user_id = ? AND menu_item_name = ?';
    db.query(checkQuery, [user_id, menu_item_name], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error checking cart item' });
        }

        if (results.length > 0) {
            // Update quantity jika item sudah ada
            const updateQuery = 'UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND menu_item_name = ?';
            db.query(updateQuery, [quantity, user_id, menu_item_name], (err, result) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error updating cart item' });
                }
                res.json({ success: true, message: 'Cart item updated successfully' });
            });
        } else {
            // Insert item baru jika belum ada
            const insertQuery = 'INSERT INTO cart_items (user_id, menu_item_name, quantity, price, image_url) VALUES (?, ?, ?, ?, ?)';
            db.query(insertQuery, [user_id, menu_item_name, quantity, price, image_url], (err, result) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Error adding cart item' });
                }
                res.json({ success: true, message: 'Cart item added successfully' });
            });
        }
    });
});

// Endpoint untuk mengambil keranjang user
app.get('/cart/:userId', (req, res) => {
    const userId = req.params.userId;

    const query = 'SELECT * FROM cart_items WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error fetching cart items' });
        }
        res.json({ success: true, cart_items: results });
    });
});

// Endpoint untuk update quantity item
app.put('/cart/update', (req, res) => {
    const { user_id, menu_item_name, quantity } = req.body;

    if (quantity <= 0) {
        // Hapus item jika quantity 0 atau kurang
        const deleteQuery = 'DELETE FROM cart_items WHERE user_id = ? AND menu_item_name = ?';
        db.query(deleteQuery, [user_id, menu_item_name], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error removing cart item' });
            }
            res.json({ success: true, message: 'Cart item removed successfully' });
        });
    } else {
        // Update quantity
        const updateQuery = 'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND menu_item_name = ?';
        db.query(updateQuery, [quantity, user_id, menu_item_name], (err, result) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error updating cart item' });
            }
            res.json({ success: true, message: 'Cart item updated successfully' });
        });
    }
});

// Endpoint untuk menghapus item dari keranjang
app.delete('/cart/remove', (req, res) => {
    const { user_id, menu_item_name } = req.body;

    const query = 'DELETE FROM cart_items WHERE user_id = ? AND menu_item_name = ?';
    db.query(query, [user_id, menu_item_name], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Error removing cart item' });
        }
        res.json({ success: true, message: 'Cart item removed successfully' });
    });
});

app.post('/reservasi', (req, res) => {
    const { user_id, package_name, reservation_date, reservation_time, name, email, phone } = req.body;

    const query = `
        INSERT INTO reservations (user_id, package_name, reservation_date, reservation_time, name, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [user_id, package_name, reservation_date, reservation_time, name, email, phone], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal membuat reservasi' });
        }
        res.json({ success: true, message: 'Reservasi berhasil dibuat' });
    });
});

app.get('/reservation-packages', (req, res) => {
    const query = 'SELECT * FROM reservation_packages';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal mengambil paket reservasi' });
        }
        res.json({ success: true, packages: results });
    });
});
app.get('/reservations', (req, res) => {
    const query = 'SELECT * FROM reservations';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal mengambil data reservasi' });
        }
        res.json({ success: true, reservations: results });
    });
});

// Endpoint to get reservations by user_id
app.get('/reservations/:userId', (req, res) => {
    const userId = req.params.userId;

    const query = 'SELECT * FROM reservations WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
        }
        res.json({ success: true, reservations: results });
    });
});
app.put('/reservations/:id/status', (req, res) => {
    const reservationId = req.params.id;
    const { status } = req.body;

    const query = 'UPDATE reservations SET status = ? WHERE id = ?';
    db.query(query, [status, reservationId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to update status' });
        }
        res.json({ success: true, message: 'Status updated successfully' });
    });
});


// Menjalankan server di port 3000
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
