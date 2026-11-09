import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["imapflow", "mailparser", "nodemailer", "@prisma/client", "bcryptjs"],
};

export default nextConfig;
