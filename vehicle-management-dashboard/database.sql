CREATE DATABASE IF NOT EXISTS motiv_vehicle_ops
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE motiv_vehicle_ops;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL DEFAULT '',
  password_hash CHAR(64) NOT NULL,
  password_salt CHAR(32) NOT NULL,
  password_iterations INT UNSIGNED NOT NULL DEFAULT 310000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  record_type VARCHAR(32) NOT NULL,
  record_key VARCHAR(100) NOT NULL,
  data JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_record (user_id, record_type, record_key),
  KEY idx_user_type (user_id, record_type),
  CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  preferences JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash CHAR(64) NOT NULL PRIMARY KEY,
  failures TINYINT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  locked_until DATETIME NULL
) ENGINE=InnoDB;

-- Initial administrator. The password is stored only as a salted PBKDF2-SHA-256 hash.
INSERT INTO users (username, display_name, email, password_hash, password_salt, password_iterations)
VALUES (
  'Eldadboateng',
  'Eldad Asante Boateng',
  'eldad.boateng@example.com',
  '9d85cd0adb0a798d32bb7d54e7d80afbd1e4bb930b8583bc83ad1ba77882aadc',
  '6d4bd9a829bdc796f2676e8276a06c23',
  310000
)
ON DUPLICATE KEY UPDATE username = VALUES(username);
