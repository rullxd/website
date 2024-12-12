// Import modul yang diperlukan
const express = require('express');
const cors = require('cors'); // Middleware untuk mengatasi CORS
const mysql = require('mysql'); // Paket untuk koneksi MySQL
const bcrypt = require('bcryptjs'); // Paket untuk hashing password
const multer = require('multer'); // Untuk mengunggah file
const path = require('path'); // Untuk manipulasi path
const nodemailer = require('nodemailer');// Inisialisasi aplikasi Express
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client('158123500330-rdcsku76df6tc8q8ubohmne58e5tgibn.apps.googleusercontent.com'); // Ganti dengan Client ID Anda
const app = express();
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const SECRET_KEY = 'your-secret-key'; // Ganti dengan kunci rahasia yang aman

// Middleware CORS - mengizinkan semua origin
app.use(cors());

// Middleware untuk parsing JSON dalam permintaan
app.use(express.json());
// Konfigurasi koneksi MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Ganti dengan username MySQL Anda
    database: 'restoransaya2' // Nama database Anda
});
// Coba koneksi ke database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
    } else {
        console.log('Connected to MySQL');
    }
});
app.post('/google-login', async (req, res) => {
    const { token } = req.body;

    try {
        // Verifikasi token menggunakan Google API
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: '158123500330-rdcsku76df6tc8q8ubohmne58e5tgibn.apps.googleusercontent.com' // Client ID Anda
        });
        const payload = ticket.getPayload();
        const email = payload['email'];

        // Cek apakah user sudah ada di database berdasarkan email
        const checkUserQuery = 'SELECT * FROM users WHERE email = ?';
        db.query(checkUserQuery, [email], (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, message: 'Server error' });
            }

            if (results.length > 0) {
                // Jika pengguna sudah ada
                const user = results[0];
                const redirectUrl = user.role === 'admin' ? 'admin.html' : 'index.html';

                // Buat token JWT untuk login
                const jwt = require('jsonwebtoken');
                const SECRET_KEY = 'your-secret-key'; // Ganti dengan kunci rahasia Anda
                const jwtToken = jwt.sign(
                    { id: user.id, role: user.role },
                    SECRET_KEY,
                    { expiresIn: '1h' } // Token berlaku 1 jam
                );

                return res.json({
                    success: true,
                    userId: user.id,
                    role: user.role,
                    token: jwtToken,
                    redirectUrl
                });
            } else {
                // Jika pengguna belum ada, tambahkan sebagai customer baru
                const insertUserQuery = 'INSERT INTO users (email, role) VALUES (?, ?)';
                db.query(insertUserQuery, [email, 'customer'], (err, result) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ success: false, message: 'Failed to save user' });
                    }

                    // Buat token JWT untuk pengguna baru
                    const jwt = require('jsonwebtoken');
                    const SECRET_KEY = 'your-secret-key';
                    const jwtToken = jwt.sign(
                        { id: result.insertId, role: 'customer' },
                        SECRET_KEY,
                        { expiresIn: '1h' }
                    );

                    return res.json({
                        success: true,
                        userId: result.insertId,
                        role: 'customer',
                        token: jwtToken,
                        redirectUrl: 'index.html'
                    });
                });
            }
        });
    } catch (error) {
        console.error('Google Token Error:', error);
        res.status(401).json({ success: false, message: 'Invalid Google token' });
    }
});
// Endpoint untuk login
app.post('/login', (req, res) => {
    const { usernameOrEmail, password } = req.body;

    // Query untuk mencari pengguna berdasarkan username atau email
    const query = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(query, [usernameOrEmail, usernameOrEmail], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
        }

        const user = results[0];

        // Verifikasi password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing password:', err);
                return res.status(500).json({ success: false, message: 'Internal server error' });
            }

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
            }

            // Jika password cocok, buat token JWT
            const token = jwt.sign(
                { id: user.id, role: user.role }, // Payload
                SECRET_KEY, // Secret key
                { expiresIn: '1h' } // Token berlaku selama 1 jam
            );

            // Kirim respons ke klien
            return res.json({
                success: true,
                userId: user.id,
                role: user.role,
                token: token
            });
        });
    });
});


// Endpoint untuk registrasi
app.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    const role = 'customer';

    // Hash password sebelum menyimpannya ke database
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            res.status(500).json({ success: false, message: 'Error hashing password' });
            return;
        }

        // Query untuk menyimpan data ke tabel users
        const insertUserQuery = 'INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)';
        db.query(insertUserQuery, [username, hashedPassword, email, role], (err, result) => {
            if (err) {
                console.error('Error inserting user:', err);
                res.status(500).json({ success: false, message: 'Gagal membuat akun' });
                return;
            }

            // Hapus data dari temp_users setelah berhasil menyimpan ke users
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
});


let verificationCode = Math.floor(100000 + Math.random() * 900000); // Kode 6 digit acak

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
        res.json({ success: true, message: 'Kode verifikasi terkirim' });
    });
}


app.post('/verifyCode', (req, res) => {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
        return res.status(400).json({ success: false, message: 'Email dan kode verifikasi wajib diisi.' });
    }

    const query = 'SELECT verification_code FROM temp_users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error Query:', err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
        }



        if (!results || results.length === 0) {
            return res.status(404).json({ success: false, message: 'Email tidak ditemukan di database.' });
        }

        const storedCode = results[0].verification_code;

        if (storedCode === verificationCode) {
            return res.json({ success: true, message: 'Kode verifikasi sesuai' });
        } else {
            return res.json({ success: false, message: 'Kode verifikasi salah atau tidak valid.' });
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



    // Masukkan data ke tabel `reservations`, termasuk tanggal yang sudah diformat
    const query = `
        INSERT INTO reservations (user_id, package_name, reservation_date, reservation_time, name, email, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;


    db.query(query, [user_id, package_name, reservation_date, reservation_time, name, email, phone], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Gagal membuat reservasi' });
        }

        // Konfigurasi email
        const mailOptions = {
            from: 'sahtulbb@gmail.com', // Ganti dengan email Anda
            to: email, // Email pengguna yang diinput di form reservasi
            subject: '🎉 Konfirmasi Reservasi Anda di [Nama Restoran]!',
            html: `
        <h2>Halo, ${name}!</h2>
        <p>Terima kasih telah memilih [Nama Restoran] untuk pengalaman bersantap Anda. Kami sangat senang menyambut Anda!</p>
        
        <h3>Detail Reservasi Anda</h3>
        <ul>
            <li><strong>Paket Pilihan:</strong> ${package_name}</li>
            <li><strong>Tanggal:</strong> ${reservation_date}</li>
            <li><strong>Waktu:</strong> ${reservation_time}</li>
            
        </ul>

        <p>Silakan datang tepat waktu agar kami dapat memberikan layanan terbaik untuk Anda.</p>

        <p><strong>Lokasi:</strong></p>
        <p>[Alamat lengkap restoran]</p>

        <h3>Butuh Bantuan?</h3>
        <p>Jika ada perubahan atau pertanyaan lebih lanjut, jangan ragu untuk menghubungi kami di <a href="mailto:sahtulbb@gmail.com">sahtulbb@gmail.com</a> atau melalui nomor telepon [Nomor Telepon Restoran].</p>

        <p>Sampai jumpa di [Nama Restoran]! 🍽️</p>
        
        <p>Salam Hangat,<br>[Nama Restoran]</p>
    `
        };


        // Kirim email menggunakan Nodemailer
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error saat mengirim email:', error);
                return res.status(500).json({ success: false, message: 'Reservasi dibuat, tapi gagal mengirim email.' });
            } else {
                console.log('Email terkirim:', info.response);
                res.status(200).json({ success: true, message: 'Reservasi berhasil dibuat dan email terkirim.' });
            }
        });
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
app.get('/reservations-per-month', (req, res) => {
    const query = `
        SELECT
    m.month AS month,
    IFNULL(COUNT(r.time_create), 0) AS total_reservations
FROM (
    SELECT 1 AS month UNION ALL
    SELECT 2 UNION ALL
    SELECT 3 UNION ALL
    SELECT 4 UNION ALL
    SELECT 5 UNION ALL
    SELECT 6 UNION ALL
    SELECT 7 UNION ALL
    SELECT 8 UNION ALL
    SELECT 9 UNION ALL
    SELECT 10 UNION ALL
    SELECT 11 UNION ALL
    SELECT 12
) m
LEFT JOIN reservations r
    ON MONTH(r.time_create) = m.month
    AND YEAR(r.time_create) = YEAR(CURDATE()) -- Hanya untuk tahun saat ini
GROUP BY m.month
ORDER BY m.month;

    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(err);
        }


        res.json(results);
    });
});
app.get('/reservations-per-day', (req, res) => {
    const query = `
        SELECT
            d.day_index,
            IFNULL(COUNT(r.time_create), 0) AS total_reservations
        FROM (
            SELECT 0 AS day_index UNION ALL
            SELECT 1 UNION ALL
            SELECT 2 UNION ALL
            SELECT 3 UNION ALL
            SELECT 4 UNION ALL
            SELECT 5 UNION ALL
            SELECT 6
        ) d
        LEFT JOIN reservations r
            ON WEEKDAY(r.time_create) = d.day_index
            AND YEARWEEK(r.time_create, 1) = YEARWEEK(CURDATE(), 1)
            AND WEEKDAY(r.time_create) BETWEEN 0 AND WEEKDAY(CURDATE())
        GROUP BY d.day_index
        ORDER BY d.day_index;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(err);
        }

        res.json(results);
    });
});
app.get('/pesanan-per-minggu', (req, res) => {
    const query = `
        SELECT
    d.day_of_week,
    COALESCE(SUM(f.food_price * f.quantity), 0) AS total_price
FROM
    (
        SELECT 0 AS day_of_week UNION ALL
        SELECT 1 UNION ALL
        SELECT 2 UNION ALL
        SELECT 3 UNION ALL
        SELECT 4 UNION ALL
        SELECT 5 UNION ALL
        SELECT 6
    ) AS d
LEFT JOIN
    food_orders AS f
ON
    d.day_of_week = WEEKDAY(f.order_date)
    AND YEARWEEK(f.order_date, 1) = YEARWEEK(CURDATE(), 1)
GROUP BY
    d.day_of_week
ORDER BY
    d.day_of_week;

    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(err);
        }

        res.json(results);
    });
});

app.get('/menupopuler', (req, res) => {
    const query = `
        SELECT
    food_name,
    SUM(quantity) AS total_quantity
FROM
    food_orders
GROUP BY
    food_name
ORDER BY
    total_quantity DESC
LIMIT 5;




    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send(err);
        }

        res.json(results);
    });
});
// Endpoint to get reservations by user_id
app.get('/reservations/:userId', (req, res) => {
    const userId = req.params.userId;

    const query = `
        SELECT * FROM reservations WHERE user_id = ?
    `;
    db.query(query, [userId, userId], (err, results) => {
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
