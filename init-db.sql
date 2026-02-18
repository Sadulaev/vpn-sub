-- Создание пользователя vpn для приложения
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'vpn') THEN
      CREATE USER vpn WITH PASSWORD 'neron';
   END IF;
END
$do$;

-- Предоставление всех прав на БД hyper_vpn пользователю vpn
GRANT ALL PRIVILEGES ON DATABASE hyper_vpn TO vpn;

-- Предоставление прав на схему public
GRANT ALL ON SCHEMA public TO vpn;

-- Предоставление прав на все таблицы в схеме public
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vpn;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vpn;

-- Предоставление прав на будущие таблицы
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vpn;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vpn;
