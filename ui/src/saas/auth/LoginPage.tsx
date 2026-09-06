import { useCallback, useState, type FormEvent } from 'react';
import { useAuth } from '../../components/auth/context/AuthContext';

type LoginPageProps = {
 onSwitchToRegister: () => void;
 /** Hide footer switch when parent already shows login/register tabs */
 hideSwitch?: boolean;
};

export default function LoginPage({ onSwitchToRegister, hideSwitch = false }: LoginPageProps) {
 const { login } = useAuth();
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [errorMessage, setErrorMessage] = useState('');
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleSubmit = useCallback(
 async (event: FormEvent) => {
 event.preventDefault();
 setErrorMessage('');
 if (!username.trim() || !password) {
 setErrorMessage('请填写用户名和密码');
 return;
 }
 setIsSubmitting(true);
 const result = await login(username.trim(), password);
 if (!result.success) {
 setErrorMessage(result.error || '登录未成功，请稍后再试');
 }
 setIsSubmitting(false);
 },
 [login, password, username],
 );

 return (
 <form onSubmit={handleSubmit} data-testid="saas-login-form">
 {errorMessage ? <div className="saas-auth-error">{errorMessage}</div> : null}
 <div className="saas-auth-field">
 <label htmlFor="saas-login-username">用户名</label>
 <input
 id="saas-login-username"
 type="text"
 autoComplete="username"
 value={username}
 onChange={(event) => setUsername(event.target.value)}
 />
 </div>
 <div className="saas-auth-field">
 <label htmlFor="saas-login-password">密码</label>
 <div className="saas-auth-pw-wrap">
 <input
 id="saas-login-password"
 type={showPassword ? 'text' : 'password'}
 autoComplete="current-password"
 value={password}
 onChange={(event) => setPassword(event.target.value)}
 />
 <button
 type="button"
 className="saas-auth-pw-toggle"
 onClick={() => setShowPassword((previous) => !previous)}
 >
 {showPassword ? '隐藏' : '显示'}
 </button>
 </div>
 </div>
 <button className="saas-auth-btn-primary" type="submit" disabled={isSubmitting}>
 {isSubmitting ? '登录中…' : '登录工作区'}
 </button>
 {hideSwitch ? null : (
 <p className="saas-auth-switch">
 还没有账户？
 <button type="button" onClick={onSwitchToRegister}>
 立即注册
 </button>
 </p>
 )}
 </form>
 );
}
