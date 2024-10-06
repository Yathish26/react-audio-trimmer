import { Title, Text } from '@mantine/core';
import PropTypes from 'prop-types';

export function TypographyH1({ text }) {
  return (
    <Title order={1} className="scroll-m-20 lg:text-5xl">
      {text}
    </Title>
  );
}

TypographyH1.propTypes = {
  text: PropTypes.string.isRequired,
};

export function TypographyH2({ text }) {
  return (
    <Title order={2} className="scroll-m-20 border-b pb-2">
      {text}
    </Title>
  );
}

TypographyH2.propTypes = {
  text: PropTypes.string.isRequired,
};

export function TypographyP({ text }) {
  return (
    <Text className="leading-7 mt-6">
      {text}
    </Text>
  );
}

TypographyP.propTypes = {
  text: PropTypes.string.isRequired,
};
