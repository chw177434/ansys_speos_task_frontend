import "./globals.css";

export const metadata = {
  title: "Ansys 远程异步仿真平台",
  description: "统一入口，选择不同 Ansys 工具并提交远程异步求解任务。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
