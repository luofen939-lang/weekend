-- 仅创建本地开发数据库，不创建带默认密码的数据库账号。
-- 你可以使用本机 MySQL 管理账号初始化；生产环境请创建独立的最小权限账号，
-- 并通过 apps/api/.env 提供凭据，不要把密码写入此文件。
CREATE DATABASE IF NOT EXISTS lazyde
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
