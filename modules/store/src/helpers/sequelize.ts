import { Model, DataTypes } from "sequelize";

export class ConnextClientData extends Model {
  public key!: string;
  public value!: JSON;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export const ConnextClientDataInitParams = {
  key: {
    type: new DataTypes.STRING(),
    primaryKey: true,
  },
  value: {
    type: new DataTypes.STRING(),
  },
};
