interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ children, className = "", onClick, hover = false }: CardProps) {
  const baseStyles = "bg-white rounded-lg shadow";
  const hoverStyles = hover ? "hover:shadow-md transition-shadow cursor-pointer" : "";

  return (
    <div className={`${baseStyles} ${hoverStyles} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-3 border-b border-gray-100 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-3 border-t border-gray-100 ${className}`}>{children}</div>;
}
