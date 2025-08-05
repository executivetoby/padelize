export const generateTeamId = () => {
  const randomLetter = () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26));

  const letters = Array(3).fill().map(randomLetter).join('');

  const digits = Array(5)
    .fill()
    .map(() => Math.floor(Math.random() * 10))
    .join('');

  return `${letters}${digits}`;
};
