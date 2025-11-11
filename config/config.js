require('dotenv').config();

module.exports = {
  development: {
    username: 'proyecto_back_ab6l_user',
    password: 't4cZJaubZN11fbmaj2ycrqyEJyl8aA3L',
    database: 'proyecto_back_ab6l',
    host: 'dpg-d49c4eali9vc739p30e0-a.oregon-postgres.render.com',
    dialect: 'postgres',
    port: 5432,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
};
