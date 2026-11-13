// 参考 NavBlog：后台提交分支在构建时确定，不在浏览器里猜测。
export function resolveDeploymentBranch(
  value: string,
  env: Record<string, string | undefined>,
  localBranch: string,
): string {
  const githubBranch =
    env['GITHUB_REF_TYPE'] === 'tag' ||
    env['GITHUB_EVENT_NAME']?.startsWith('pull_request')
      ? ''
      : env['GITHUB_REF_NAME']
  const branch =
    value === 'auto'
      ? [
          env['CF_PAGES_BRANCH'],
          githubBranch,
          env['BRANCH'],
          env['VERCEL_GIT_COMMIT_REF'],
          env['CI_COMMIT_BRANCH'],
          localBranch,
        ].find((name) => name !== undefined && name.length > 0) || ''
      : value
  if (!branch)
    throw new Error(
      '无法识别部署分支，请在 nav.config.yaml 的 branch 填写实际 Git 分支',
    )
  if (
    branch === 'HEAD' ||
    branch.startsWith('-') ||
    // eslint-disable-next-line no-control-regex -- Git 分支不能包含控制字符或引用表达式。
    /[\u0000-\u0020\u007f~^:?*[\\]/.test(branch) ||
    branch.includes('..') ||
    branch.includes('@{') ||
    branch.endsWith('.') ||
    branch
      .split('/')
      .some((part) => !part || part.startsWith('.') || part.endsWith('.lock'))
  )
    throw new Error('提交分支名称无效，请填写实际 Git 分支或 auto')
  return branch
}
