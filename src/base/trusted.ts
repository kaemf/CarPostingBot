import dotenv from "dotenv";

dotenv.config();

export default function TRUSTED_USERS(userId: string) {
    const Users = Object.entries(process.env)
        .filter(([key]) => key.startsWith("USER"))
        .map(([, value]) => value)
        .filter(Boolean);

    return Users.includes(userId);
}